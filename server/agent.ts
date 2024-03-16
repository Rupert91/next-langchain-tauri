import { StreamingTextResponse} from 'ai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { TavilySearchResults } from "./custom/tools/tavily/tavily_search";
import { BingSerpAPI } from "./custom/tools/bing/bingserpapi";
import { GoogleCustomSearch } from "./custom/tools/google/google_custom_search";
import { ChatGoogleGenerativeAI } from "./custom/llm/gemini";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { AIMessage, ChatMessage, HumanMessage } from "@langchain/core/messages";

const convertMessageToLangChainMessage = (message: any) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

export async function Chat(body: any) {
  // console.log(body)
  const messages = (body.messages ?? []).filter(
    (message: any) =>
      message.role === "user" || message.role === "assistant",
  ).map(convertMessageToLangChainMessage);;
  process.env.TAVILY_API_KEY = body.previewToken.tavilyserp_api_key
  process.env.GOOGLE_API_KEY = body.previewToken.google_api_key
  process.env.GOOGLE_CSE_ID = body.previewToken.google_cse_id
  var model:any
  if(body.previewToken.llm_model==='gemini-pro'){
      model = new ChatGoogleGenerativeAI({
        apiKey: body.previewToken.llm_api_key,
        baseURL: body.previewToken?.llm_base_url || null,
        modelName: "gemini-pro",
        maxOutputTokens: 8192,
    });
  }else{
    model = new ChatOpenAI({
      temperature: 0.7,
      modelName: body.previewToken.llm_model || 'gpt-3.5-turbo-0125',
      openAIApiKey: body.previewToken.llm_api_key,
      configuration: { baseURL: body.previewToken?.llm_base_url || 'https://api.openai.com/v1' },
      maxTokens: 2048,
      streaming: true
    });
  }
  
  if(!body.messages.slice(-1)[0].function_call){
    const outputParser = new HttpResponseOutputParser()
    const stream = await model.pipe(outputParser).stream(messages);
    return new StreamingTextResponse(stream);
  }

  var tools: (BingSerpAPI | TavilySearchResults | GoogleCustomSearch )[] = [];
  if (body.previewToken.tavilyserp_api_key) {
    tools.push(new TavilySearchResults({maxResults: 5}));
  }
  if (body.previewToken.bing_api_key) {
    tools.push(new BingSerpAPI(body.previewToken.bing_api_key));
  }
  if (body.previewToken.google_api_key) {
    tools.push(new GoogleCustomSearch());
  }

  var SYSTEM_TEMPLATE = `You are a helpful assistant with tools {tools}.

Think: Do I need a tool now? if YES,call one of {tool_names},the following format(MUST)
'''
   Action: a tool you choose
   Action Input: the most needed keyword for filling the answer
'''
the stop output, wait for the user input.

If NO and you get enough information, plz output final answer startswith "**Final Answer:**" (MUST), the answer should be in the language ${body.locale.startsWith('en')?'':body.locale} which user asked

---
{agent_scratchpad}
---
Begin!
`

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_TEMPLATE],
    ["human", "{input}"],
  ]);
  
  const agent = await createReactAgent({
    llm: model,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    returnIntermediateSteps: true,
    verbose: false
  });
  const previousMessages = messages.slice(0, -1)
  const currentMessageContent = messages[messages.length - 1].content;

  if(body.no_stream){
    const result = await agentExecutor.invoke({
      input: currentMessageContent,
      chat_history: previousMessages,
    });
    return Response.json(
      { output: result.output, intermediate_steps: result.intermediateSteps },
      { status: 200 },
    );
  }

  const logStream = await agentExecutor.streamLog({
    input: currentMessageContent,
    chat_history: previousMessages,
    verbose: false
  });
  const encoder = new TextEncoder()
  
  const transformStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of logStream) {
        if (chunk.ops?.length > 0 && chunk.ops[0].op === "add") {
          const addOp = chunk.ops[0];
          // console.log(addOp.path,addOp.value)
          if (addOp.path.startsWith("/logs/googlegenerativeai:2/stream") ||
            addOp.path.startsWith("/logs/ChatOpenAI") &&
            typeof addOp.value === "string" &&
            addOp.value.length
          ) {
            controller.enqueue(encoder.encode(addOp.value));
          }
          if(addOp.path.startsWith('/logs/BingSerpAPI/final_output') || addOp.path.startsWith('/logs/GoogleCustomSearch/final_output') || addOp.path.startsWith('/logs/TavilySearchResults/final_output')){
            controller.enqueue(encoder.encode('\n\n---\n\n'+ addOp.value.output.split('\n\n').map((line:string)=>line.split(']')[1]).join('\n\n') +'\n\n---\n\n'));
          }
        }
      }
      controller.close();
    },
  });

  return new StreamingTextResponse(transformStream);
}