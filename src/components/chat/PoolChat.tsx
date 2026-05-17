'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/Avatar';
import { formatDistanceToNow } from 'date-fns';
import type { PoolMessage, Profile } from '@/types';
import { Send, Pin } from 'lucide-react';

interface Props {
  poolId: string;
  currentUser: Profile | null;
}

const COMMON_EMOJIS = ['👍', '🔥', '😂', '💀', '🎯', '🏆', '😤', '🤞'];

export function PoolChat({ poolId, currentUser }: Props) {
  const [messages, setMessages] = useState<PoolMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pool_messages')
      .select('*, profiles(id, username, avatar_url, role, wins, losses, pushes, pools_entered, pools_won, created_at)')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) setMessages(data as any);
    setLoading(false);
  }, [poolId, supabase]);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`chat-${poolId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pool_messages', filter: `pool_id=eq.${poolId}` },
        async (payload) => {
          const { data } = await supabase
            .from('pool_messages')
            .select('*, profiles(id, username, avatar_url, role, wins, losses, pushes, pools_entered, pools_won, created_at)')
            .eq('id', payload.new.id)
            .single();
          if (data) setMessages(prev => [...prev, data as any]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [poolId, loadMessages, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentUser || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    // Parse mentions
    const mentions = [...msg.matchAll(/@(\w+)/g)].map(m => m[1]);

    await supabase.from('pool_messages').insert({
      pool_id: poolId,
      user_id: currentUser.id,
      message: msg,
      message_type: 'user',
      mentions,
    });
    setSending(false);
  };

  const addReaction = async (messageId: string, emoji: string, currentReactions: Record<string, string[]>) => {
    if (!currentUser) return;
    const existing = currentReactions[emoji] ?? [];
    const alreadyReacted = existing.includes(currentUser.id);
    const updated = alreadyReacted
      ? { ...currentReactions, [emoji]: existing.filter(id => id !== currentUser.id) }
      : { ...currentReactions, [emoji]: [...existing, currentUser.id] };
    // Remove key if empty
    if (updated[emoji]?.length === 0) delete updated[emoji];

    await supabase.from('pool_messages').update({ reactions: updated }).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: updated } : m));
  };

  const highlightMentions = (text: string): React.ReactNode => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((p, i) =>
      p.startsWith('@')
        ? <span key={i} className="text-blue-400 font-medium">{p}</span>
        : p
    );
  };

  const pinnedMessages = messages.filter(m => m.message_type === 'pinned');

  return (
    <div className="flex flex-col h-[600px] bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Pinned messages */}
      {pinnedMessages.length > 0 && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 space-y-1">
          {pinnedMessages.map(m => (
            <div key={m.id} className="flex items-center gap-2 text-xs text-yellow-400">
              <Pin size={12} /> {m.message}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {loading && <div className="text-center text-gray-500 py-8">Loading messages...</div>}
        {!loading && messages.filter(m => m.message_type !== 'pinned').length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">No messages yet. Say something!</div>
        )}
        {messages.filter(m => m.message_type !== 'pinned').map(msg => {
          if (msg.message_type === 'system') {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-xs text-gray-500 italic bg-gray-800 px-3 py-1 rounded-full">
                  {msg.message}
                </span>
              </div>
            );
          }
          const isMe = msg.user_id === currentUser?.id;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
              <Avatar
                src={(msg as any).profiles?.avatar_url}
                username={(msg as any).profiles?.username ?? '?'}
                size="sm"
                className="flex-shrink-0"
              />
              <div className={`flex-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col max-w-[80%]`}>
                <div className={`flex items-baseline gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-medium text-gray-400">
                    {(msg as any).profiles?.username ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-600">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className={`rounded-xl px-3 py-2 text-sm text-white leading-relaxed mt-0.5 ${
                  isMe ? 'bg-green-600/30 border border-green-500/30' : 'bg-gray-800 border border-gray-700'
                }`}>
                  {highlightMentions(msg.message ?? '')}
                </div>
                {/* Reactions */}
                <div className={`flex items-center gap-1 mt-1 flex-wrap ${isMe ? 'flex-row-reverse' : ''}`}>
                  {Object.entries(msg.reactions || {}).map(([emoji, users]) =>
                    (users as string[]).length > 0 ? (
                      <button
                        key={emoji}
                        onClick={() => addReaction(msg.id, emoji, msg.reactions)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                          currentUser && (users as string[]).includes(currentUser.id)
                            ? 'bg-green-500/20 border-green-500/40 text-white'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {emoji} {(users as string[]).length}
                      </button>
                    ) : null
                  )}
                  {/* Emoji picker */}
                  <div className="relative group">
                    <button className="text-xs text-gray-600 hover:text-gray-400 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      +😀
                    </button>
                    <div className="absolute bottom-full left-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg p-2 flex gap-1 z-10 hidden group-hover:flex shadow-xl">
                      {COMMON_EMOJIS.map(e => (
                        <button
                          key={e}
                          onClick={() => addReaction(msg.id, e, msg.reactions)}
                          className="text-base hover:scale-125 transition-transform"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {currentUser ? (
        <form onSubmit={sendMessage} className="border-t border-gray-800 p-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Message the group... (@mention someone)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { sendMessage(e as any); } }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black p-2 rounded-lg transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      ) : (
        <div className="border-t border-gray-800 p-3 text-center text-gray-500 text-sm">
          <a href="/login" className="text-green-400 hover:text-green-300">Log in</a> to participate in chat
        </div>
      )}
    </div>
  );
}
