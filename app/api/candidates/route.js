import { NextResponse } from 'next/server';
import { getCandidates, getDbMode, deleteCandidate, clearAllCandidates } from '@/lib/db';
import { getAiMode } from '@/lib/gemini';

export async function GET() {
  try {
    const candidates = await getCandidates();
    return NextResponse.json({
      success: true,
      candidates,
      meta: {
        dbMode: getDbMode(),
        aiMode: getAiMode()
      }
    });
  } catch (err) {
    console.error('API get candidates error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    if (id === 'all') {
      const success = await clearAllCandidates();
      if (!success) {
        return NextResponse.json({ error: 'Failed to clear talent pool' }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'All candidates deleted successfully' });
    }

    const success = await deleteCandidate(id);
    if (!success) {
      return NextResponse.json({ error: 'Candidate not found or delete failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Candidate deleted successfully' });
  } catch (err) {
    console.error('API delete candidate error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
