'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, calculatePrizePool, getContestFormatLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { ContestFormat } from '@/types';
import { ChevronRight, ChevronLeft, Trophy } from 'lucide-react';

const SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'CFB', 'CBB', 'Soccer', 'UFC', 'WNBA', 'Other'];
const FORMATS: { value: ContestFormat; label: string; desc: string }[] = [
  { value: 'classic', label: 'Classic Survival', desc: 'One life. Lose once, you\'re out.' },
  { value: 'lives', label: 'Lives Mode', desc: 'Multiple lives. Survive until all lives are gone.' },
  { value: 'first_to_x', label: 'First To X Wins', desc: 'Race to reach the target win count.' },
  { value: 'best_record', label: 'Best Record', desc: 'Most wins after N rounds wins.' },
  { value: 'streak_race', label: 'Streak Race', desc: 'Build the longest consecutive win streak.' },
  { value: 'team_battle', label: 'Team Battle', desc: 'Compete in teams, last team standing wins.' },
];

const TOTAL_STEPS = 6;

export default function CreatePoolPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [sport, setSport] = useState('NFL');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [maxEntries, setMaxEntries] = useState('');

  // Step 2: Format
  const [contestFormat, setContestFormat] = useState<ContestFormat>('classic');
  const [livesCount, setLivesCount] = useState('3');
  const [targetWins, setTargetWins] = useState('10');
  const [targetStreak, setTargetStreak] = useState('5');
  const [maxLosses, setMaxLosses] = useState('');
  const [pushResetsStreak, setPushResetsStreak] = useState(false);

  // Step 3: Entry & Prize
  const [entryFeeDollars, setEntryFeeDollars] = useState('0');
  const [rakePercentage, setRakePercentage] = useState('10');

  // Step 4: Schedule
  const [startDate, setStartDate] = useState('');
  const [pickDeadline, setPickDeadline] = useState('');
  const [roundFrequency, setRoundFrequency] = useState<'daily' | 'weekly'>('weekly');

  // Step 5: Rules
  const [pushRule, setPushRule] = useState<'advance' | 'eliminate' | 'repeat'>('advance');
  const [allLoseRule, setAllLoseRule] = useState<'repeat' | 'split' | 'tiebreak'>('repeat');

  const entryFeeCents = Math.round(parseFloat(entryFeeDollars || '0') * 100);
  const mockEntries = 10;
  const { netPrizePool, platformFee } = calculatePrizePool(entryFeeCents, mockEntries, parseFloat(rakePercentage || '10'));

  const handleSubmit = async () => {
    setLoading(true);
    const res = await fetch('/api/pools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        sport,
        visibility,
        max_entries: maxEntries ? parseInt(maxEntries) : null,
        contest_format: contestFormat,
        lives_count: parseInt(livesCount),
        target_wins: parseInt(targetWins),
        target_streak: parseInt(targetStreak),
        max_losses: maxLosses ? parseInt(maxLosses) : null,
        push_resets_streak: pushResetsStreak,
        entry_fee_cents: entryFeeCents,
        rake_percentage: parseFloat(rakePercentage),
        start_date: new Date(startDate).toISOString(),
        pick_deadline: new Date(pickDeadline).toISOString(),
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
    if (step === 4) return startDate && pickDeadline;
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
            <Input label="Max Entries (optional)" type="number" value={maxEntries} onChange={e => setMaxEntries(e.target.value)} placeholder="Unlimited" min="2" />
          </CardBody>
        </Card>
      )}

      {/* Step 2: Format */}
      {step === 2 && (
        <Card>
          <CardHeader><h3 className="font-bold text-white">Contest Format</h3></CardHeader>
          <CardBody className="space-y-4">
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
            <Input
              label="Entry Fee (USD, 0 for free)"
              type="number"
              value={entryFeeDollars}
              onChange={e => setEntryFeeDollars(e.target.value)}
              min="0"
              step="1"
              placeholder="0"
            />
            <Input
              label="Platform Rake (%)"
              type="number"
              value={rakePercentage}
              onChange={e => setRakePercentage(e.target.value)}
              min="0"
              max="30"
              step="0.5"
              hint="Percentage taken before distributing prizes"
            />
            {entryFeeCents > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="font-bold text-white mb-2">Prize Preview ({mockEntries} entries)</div>
                <div className="flex justify-between text-gray-400">
                  <span>Gross pot</span>
                  <span>{formatCents(entryFeeCents * mockEntries)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Platform fee ({rakePercentage}%)</span>
                  <span>-{formatCents(platformFee)}</span>
                </div>
                <div className="flex justify-between text-green-400 font-bold border-t border-gray-700 pt-2">
                  <span>Net prize pool</span>
                  <span>{formatCents(netPrizePool)}</span>
                </div>
              </div>
            )}
            {entryFeeCents === 0 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-blue-400 text-sm">
                Free contest — no entry fee required. Great for friendly competitions!
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
              type="datetime-local"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
            />
            <Input
              label="First Pick Deadline"
              type="datetime-local"
              value={pickDeadline}
              onChange={e => setPickDeadline(e.target.value)}
              required
              hint="Participants must submit picks before this time"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Round Frequency</label>
              <div className="flex gap-2">
                {(['daily', 'weekly'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setRoundFrequency(f)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                      roundFrequency === f ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}>
                    {f}
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
                { label: 'Entry Fee', value: entryFeeCents > 0 ? formatCents(entryFeeCents) : 'Free' },
                { label: 'Rake', value: `${rakePercentage}%` },
                { label: 'Frequency', value: roundFrequency },
                { label: 'Push Rule', value: pushRule },
                { label: 'All-Lose Rule', value: allLoseRule },
                { label: 'Max Entries', value: maxEntries || 'Unlimited' },
              ].map(item => (
                <div key={item.label} className="bg-gray-800 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className="font-medium text-white mt-0.5">{item.value}</div>
                </div>
              ))}
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
