import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  const filePath = join(process.cwd(), 'public', 'data', 'latest.json')

  if (!existsSync(filePath)) {
    return NextResponse.json(
      { lists: [], scraped_at: null, total_lists: 0, total_applicants: 0 },
      { status: 200 }
    )
  }

  const raw = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
