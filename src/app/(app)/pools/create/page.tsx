'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getContestFormatLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { ContestFormat } from '@/types';
import { ChevronRight, ChevronLeft, Trophy } from 'lucide-react';

const SPORTS = ['All Sports', 'NBA', 'WNBA', 'MLB', 'NHL', 'ATP', 'WTA'];
const FORMATS: { value: ContestFormat; label: string; desc: string }[] = [
  { value: 'classic', label: 'Classic Survival', desc: 'One life. Lose once, you\'re out.' },
  { value: 'lives', label: 'Lives Mode', desc: 'Multiple lives. Survive until all lives are gone.' },
  { value: 'first_to_x', label: 'First To X Wins', desc: 'Race to reach the target win count.' },
  { value: 'best_record', label: 'Best Record', desc: 'Most wins after N rounds wins.' },
  { value: 'streak_race', label: 'Streak Race', desc: 'Build the longest consecutive win streak.' },
];

const TOTAL_STEPS = 6;

export default function CreatePoolPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [sport, setSport] = useState('All Sports');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [maxEntries, setMaxEntries] = useState('');
  const [poolType, setPoolType] = useState<'cash' | 'free'>('free');

  // Step 2: Format
  const [isTeamPool, setIsTeamPool] = useState(false);
  const [teamSize, setTeamSize] = useState('2');
  const [contestFormat, setContestFormat] = useState<ContestFormat>('classic');
  const [livesCount, setLivesCount] = useState('3');
  const [targetWins, setTargetWins] = useState('10');
  const [targetStreak, setTargetStreak] = useState('5');
  const [maxLosses, setMaxLosses] = useState('');
  const [pushResetsStreak, setPushResetsStreak] = useState(false);

  // Step 3: Entry & Prize
  const [entryFeeCoins, setEntryFeeCoins] = useState('0');
  const rakePercentage = '10';

  // Step 4: Schedule
  const [startDate, setStartDate] = useState('');
  const [roundFrequency, setRoundFrequency] = useState<'daily' | 'weekly' | 'game_day'>('daily');

  // Step 5: Rules
  const [pushRule, setPushRule] = useState<'advance' | 'eliminate' | 'repeat'>('advance');
  const [allLoseRule, setAllLoseRule] = useState<'repeat' | 'split' | 'tiebreak'>('repeat');


  const handleSubmit = async () => {
    setLoading(true);
    const res = await fetch('/api/pools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        sport,
        visibility,
        pool_type: poolType,
        max_entries: maxEntries ? parseInt(maxEntries) : null,
        contest_format: isTeamPool ? 'team_battle' : contestFormat,
        team_scoring: isTeamPool ? contestFormat : null,
        team_size: isTeamPool ? parseInt(teamSize) || 2 : null,
        lives_count: parseInt(livesCount),
        target_wins: parseInt(targetWins),
        target_streak: parseInt(targetStreak),
        max_losses: maxLosses ? parseInt(maxLosses) : null,
        push_resets_streak: pushResetsStreak,
        entry_fee_cents: 0,
        entry_fee_coins: parseInt(entryFeeCoins) || 0,
        rake_percentage: parseFloat(rakePercentage),
        start_date: new Date(`${startDate}T00:00:00`).toISOString(),
        round_frequency: roundFrequency,
        push_rule: pushRule,
        all_lose_rule: allLoseRule,
        prize_structure: 'winner_take_all',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Failed to create contest');
      setLoading(false);
      return;
    }
    toast.success('Contest created!');
    router.push(`/pools/${data.pool.id}`);
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length >= 3;
    if (step === 4) return !!startDate;
    return true;
  };

  const stepLabels = ['Basic Info', 'Format', 'Entry & Prize', 'Schedule', 'Rules', 'Review'];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">Create a Contest</h1>
        <p className="text-gray-400 mt-1">Set up a new peer-to-peer survival picking contest.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${
              i + 1 < step ? 'bg-green-500 text-black' :
              i + 1 === step ? 'bg-green-500/20 border-2 border-green-500 text-green-400' :
              'bg-gray-800 text-gray-500'
            }`}>
              {i + 1 < step ? '✓' : i + 1}
            </div>
            {i < stepLabels.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 ${i + 1 < step ? 'bg-green-500' : 'bg-gray-800'}`} />
            )}
          </div>
        ))}
      </div>
      <div className="text-sm text-gray-400 font-medium">Step {step}: {stepLabels[step - 1]}</div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardHeader><h3 className="font-bold text-white">Basic Information</h3></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Contest Name" value={name} onChange={e => setName(e.target.value)} placeholder="NFL Survivor Pool 2025" required />
            <Select
              label="Sport"
              value={sport}
              onChange={e => setSport(e.target.value)}
              options={SPORTS.map(s => ({ value: s, label: s }))}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Visibility</label>
              <div className="flex gap-2">
                {(['public', 'private'] as const).map(v => (
                  <button key={v} type="button" onClick={() => setVisibility(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                      visibility === v ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{visibility === 'private' ? 'Only accessible via invite code' : 'Visible in public browse'}</p>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Prize Type</label>
              <div className="flex gap-2">
                {([
                  { value: 'free', label: '🆓 Free Pool', desc: 'Gold Coins only — open to all US states' },
                  { value: 'cash', label: '💰 Cash Pool', desc: 'Sweeps Coins redeemable for cash prizes' },
                ] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setPoolType(opt.value)}
                    className={`flex-1 text-left px-4 py-3 rounded-xl border transition-colors ${
                      poolType === opt.value ? 'bg-green-500/20 border-green-500/50' : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}>
                    <div className="font-bold text-white text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <Input label="Max Entries (optional)" type="number" value={maxEntries} onChange={e => setMaxEntries(e.target.value)} placeholder="Unlimited" min="2" />
          </CardBody>
        </Card>
      )}

      {/* Step 2: Format */}
      {step === 2 && (
        <Card>
          <CardHeader><h3 className="font-bold text-white">Contest Format</h3></CardHeader>
          <CardBody className="space-y-5">
            {/* Solo / Team toggle */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Pool Type</label>
              <div className="flex gap-2">
                {[
                  { value: false, label: 'Solo', desc: 'Each player picks individually' },
                  { value: true, label: 'Team', desc: 'Players grouped into teams — all picks must hit (parlay)' },
                ].map(opt => (
                  <button key={String(opt.value)} type="button" onClick={() => setIsTeamPool(opt.value)}
                    className={`flex-1 text-left px-4 py-3 rounded-xl border transition-colors ${
                      isTeamPool === opt.value
                        ? 'bg-green-500/20 border-green-500/50'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}>
                    <div className="font-bold text-white text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Team size — only shown for team pools */}
            {isTeamPool && (
              <Input
                label="Players Per Team"
                type="number"
                value={teamSize}
                onChange={e => setTeamSize(e.target.value)}
                min="2"
                max="10"
                hint="All players on a team must win for the team to advance. Any loss = team loses."
              />
            )}

            {/* Format picker — same options for solo and team */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Contest Style</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FORMATS.map(f => (
                  <button key={f.value} type="button" onClick={() => setContestFormat(f.value)}
                    className={`text-left p-4 rounded-xl border transition-colors ${
                      contestFormat === f.value
                        ? 'bg-purple-500/20 border-purple-500/50'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}>
                    <div className="font-bold text-white text-sm">{f.label}</div>
                    <div className="text-gray-400 text-xs mt-1">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Format-specific settings */}
            {contestFormat === 'lives' && (
              <Input label="Number of Lives" type="number" value={livesCount} onChange={e => setLivesCount(e.target.value)} min="2" max="10" />
            )}
            {contestFormat === 'first_to_x' && (
              <>
                <Input label="Target Wins" type="number" value={targetWins} onChange={e => setTargetWins(e.target.value)} min="2" />
                <Input label="Max Losses (optional, 0 = unlimited)" type="number" value={maxLosses} onChange={e => setMaxLosses(e.target.value)} min="0" />
              </>
            )}
            {contestFormat === 'streak_race' && (
              <>
                <Input label="Target Streak (consecutive wins)" type="number" value={targetStreak} onChange={e => setTargetStreak(e.target.value)} min="2" />
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="prs" checked={pushResetsStreak} onChange={e => setPushResetsStreak(e.target.checked)} className="rounded" />
                  <label htmlFor="prs" className="text-sm text-gray-300">Push resets streak to zero</label>
                </div>
              </>
            )}
            {contestFormat === 'best_record' && (
              <Input label="Contest Duration (rounds)" type="number" value={targetWins} onChange={e => setTargetWins(e.target.value)} min="1" hint="How many rounds before determining the winner" />
            )}
          </CardBody>
        </Card>
      )}

      {/* Step 3: Entry & Prize */}
      {step === 3 && (
        <Card>
          <CardHeader><h3 className="font-bold text-white">Entry Fee & Prize</h3></CardHeader>
          <CardBody className="space-y-4">
            {poolType === 'free' ? (
              <>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 text-blue-400 text-sm">
                  Free pools award Gold Coins to the winner. No cash prizes.
                </div>
                <Input
                  label="Entry Fee (Gold Coins)"
                  type="number"
                  value={entryFeeCoins}
                  onChange={e => setEntryFeeCoins(e.target.value)}
                  min="0"
                  hint="Set to 0 for a completely free contest. Gold Coins have no cash value."
                />
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-yellow-400 text-sm">
                  Cash pools use Sweeps Coins redeemable for real prizes. Entry fees are set in Gold Coins. Prize pool is capped at $4,999.
                </div>
                <Input
                  label="Entry Fee (Gold Coins)"
                  type="number"
                  value={entryFeeCoins}
                  onChange={e => setEntryFeeCoins(e.target.value)}
                  min="0"
                  hint="Gold Coins required to enter. 100 GC = $1.00 USD."
                />
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Step 4: Schedule */}
      {step === 4 && (
        <Card>
          <CardHeader><h3 className="font-bold text-white">Schedule</h3></CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              hint="Picks are due by 9:30 PM ET on the start date"
            />
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Round Frequency</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'daily', label: 'Daily', desc: 'New round every day' },
                  { value: 'weekly', label: 'Weekly', desc: 'New round every week' },
                  { value: 'game_day', label: 'Game Day', desc: 'Auto-schedules when NBA games are on' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRoundFrequency(opt.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${roundFrequency === opt.value ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                  >
                    <div className="text-sm font-medium text-white">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 5: Rules */}
      {step === 5 && (
        <Card>
          <CardHeader><h3 className="font-bold text-white">Contest Rules</h3></CardHeader>
          <CardBody className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Push / Void Rule</label>
              {([
                { value: 'advance', label: 'Advance', desc: 'Push/void counts as a win — participant advances' },
                { value: 'eliminate', label: 'Eliminate', desc: 'Push/void counts as a loss — participant eliminated' },
                { value: 'repeat', label: 'Repeat', desc: 'Push/void — participant must re-pick next round' },
              ] as const).map(opt => (
                <button key={opt.value} type="button" onClick={() => setPushRule(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    pushRule === opt.value ? 'bg-green-500/20 border-green-500/50' : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}>
                  <div className="font-medium text-white text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">All-Lose Rule (everyone loses same round)</label>
              {([
                { value: 'repeat', label: 'Repeat Round', desc: 'Everyone survives, round replays next week' },
                { value: 'split', label: 'Split Prize', desc: 'Everyone splits the prize pool equally' },
                { value: 'tiebreak', label: 'Tiebreaker', desc: 'Use W-L record as tiebreaker' },
              ] as const).map(opt => (
                <button key={opt.value} type="button" onClick={() => setAllLoseRule(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    allLoseRule === opt.value ? 'bg-blue-500/20 border-blue-500/50' : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}>
                  <div className="font-medium text-white text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 6: Review */}
      {step === 6 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-yellow-400" />
              <h3 className="font-bold text-white">Review & Create</h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name', value: name },
                { label: 'Sport', value: sport },
                { label: 'Format', value: getContestFormatLabel(contestFormat) },
                { label: 'Visibility', value: visibility },
                { label: 'Entry Fee', value: parseInt(entryFeeCoins) > 0 ? `${parseInt(entryFeeCoins).toLocaleString()} GC` : 'Free' },
                { label: 'Start Date', value: startDate ? new Date(`${startDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
                { label: 'Frequency', value: roundFrequency },
                { label: 'Push Rule', value: pushRule },
                { label: 'All-Lose Rule', value: allLoseRule },
                { label: 'Pool Type', value: isTeamPool ? `Team (${teamSize} per team)` : 'Solo' },
                { label: 'Prize Type', value: poolType === 'free' ? 'Free (Gold Coins)' : 'Cash (Sweeps Coins)' },
                { label: 'Max Entries', value: maxEntries || 'Unlimited' },
              ].map(item => (
                <div key={item.label} className="bg-gray-800 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className="font-medium text-white mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 text-blue-400 text-xs">
              Picks for Round 1 are due by 9:30 PM ET on the start date. Subsequent round deadlines are set automatically.
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-yellow-400 text-xs">
              By creating this contest you confirm it is a peer-to-peer picking contest only. All participants must be 18+.
            </div>
          </CardBody>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
        >
          <ChevronLeft size={16} className="mr-1" /> Back
        </Button>

        {step < TOTAL_STEPS ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
            Next <ChevronRight size={16} className="ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={loading}>
            Create Contest
          </Button>
        )}
      </div>
    </div>
  );
}
