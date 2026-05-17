'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface Props {
  profileId: string;
  currentUserId: string;
  initiallyFollowing: boolean;
}

export function FollowButton({ profileId, currentUserId, initiallyFollowing }: Props) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const toggle = async () => {
    setLoading(true);
    if (following) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profileId);
      if (!error) { setFollowing(false); toast.success('Unfollowed'); }
      else toast.error(error.message);
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: profileId });
      if (!error) { setFollowing(true); toast.success('Following!'); }
      else toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <Button
      variant={following ? 'secondary' : 'primary'}
      size="sm"
      loading={loading}
      onClick={toggle}
    >
      {following ? 'Unfollow' : 'Follow'}
    </Button>
  );
}
