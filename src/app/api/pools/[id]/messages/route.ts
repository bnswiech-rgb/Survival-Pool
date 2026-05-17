import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('pool_messages')
    .select('*, profiles(id, username, avatar_url)')
    .eq('pool_id', id)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { message, message_type } = await request.json();
  if (!message?.trim()) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });

  const mentions = [...message.matchAll(/@(\w+)/g)].map((m: any) => m[1]);

  const { data, error } = await supabase
    .from('pool_messages')
    .insert({
      pool_id: id,
      user_id: user.id,
      message,
      message_type: message_type ?? 'user',
      mentions,
    })
    .select('*, profiles(id, username, avatar_url)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
}
