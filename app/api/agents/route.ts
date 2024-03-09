import { Agents } from '@/server/agent'
export const runtime = 'edge';

export async function POST(req: Request) {
  const json = await req.json()
  return Agents(json)
}