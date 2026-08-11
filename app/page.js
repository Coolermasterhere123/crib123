"use client";

import { useEffect, useMemo, useState } from 'react';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';

export default function CribbageGame() {
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [aiHand, setAiHand] = useState([]);
  const [crib, setCrib] = useState([]);
  const [starter, setStarter] = useState(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [dealer, setDealer] = useState('ai');
  const [dealCount, setDealCount] = useState(0);
  const [playerCountingHand, setPlayerCountingHand] = useState([]);
  const [aiCountingHand, setAiCountingHand] = useState([]);
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState('idle'); // idle, discard, pegging, counting-ready, counting
  const [selected, setSelected] = useState([]);
  const [pegTotal, setPegTotal] = useState(0);
  const [pegPile, setPegPile] = useState([]);
  const [turn, setTurn] = useState('player');
  const [lastPegOwner, setLastPegOwner] = useState(null);
  const [pegEffect, setPegEffect] = useState(false);

  useEffect(() => {
    // prepare deck
    resetGame();
  }, []);

  function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = [
      { r: 'A', v: 1, v15: 1 },
      { r: '2', v: 2, v15: 2 },
      { r: '3', v: 3, v15: 3 },
      { r: '4', v: 4, v15: 4 },
      { r: '5', v: 5, v15: 5 },
      { r: '6', v: 6, v15: 6 },
      { r: '7', v: 7, v15: 7 },
      { r: '8', v: 8, v15: 8 },
      { r: '9', v: 9, v15: 9 },
      { r: '10', v: 10, v15: 10 },
      { r: 'J', v: 11, v15: 10 },
      { r: 'Q', v: 12, v15: 10 },
      { r: 'K', v: 13, v15: 10 },
    ];

    const d = [];
    for (const s of suits) {
      for (const rk of ranks) {
        d.push({ suit: s, rank: rk.r, value: rk.v, value15: rk.v15, id: s + rk.r + Math.random().toString(36).slice(2, 7) });
      }
    }
    return d;
  }

  function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function resetGame() {
    const d = shuffle(createDeck());
    setDeck(d);
    setPlayerHand([]);
    setAiHand([]);
    setCrib([]);
    setStarter(null);
    setPhase('idle');
    setPlayerScore(0);
    setAiScore(0);
    setDealer('ai');
    setDealCount(0);
    setMessage('Press Deal to start a new hand.');
    setSelected([]);
    setPegTotal(0);
    setPegPile([]);
    setLastPegOwner(null);
  }

  function pickDealerByCut(deck) {
    const drawCard = () => deck[Math.floor(Math.random() * deck.length)];
    while (true) {
      const playerCut = drawCard();
      let aiCut = drawCard();
      if (aiCut.id === playerCut.id) continue;
      if (playerCut.value === aiCut.value) continue;
      return playerCut.value < aiCut.value ? 'player' : 'ai';
    }
  }

  function deal() {
    const d = shuffle(createDeck());
    const whoIsDealer = dealCount === 0 ? pickDealerByCut(d) : dealer === 'player' ? 'ai' : 'player';
    const pHand = d.slice(0, 6);
    const aHand = d.slice(6, 12);
    const rest = d.slice(12);
    setDeck(rest);
    setPlayerHand(pHand);
    setAiHand(aHand);
    setCrib([]);
    setDealer(whoIsDealer);
    setDealCount(prev => prev + 1);
    setPhase('discard');
    setMessage(
      'Select 2 cards to discard to the crib. Dealer: ' +
        whoIsDealer +
        '. ' +
        (whoIsDealer === 'player' ? 'AI' : 'You') +
        ' play first.'
    );
    setSelected([]);
    setPegPile([]);
    setPegTotal(0);
    setLastPegOwner(null);
  }

  function toggleSelect(cardId) {
    if (phase !== 'discard') return;
    setSelected(prev => {
      if (prev.includes(cardId)) return prev.filter(x => x !== cardId);
      if (prev.length >= 2) return prev;
      return [...prev, cardId];
    });
  }

  function finishDiscard() {
    if (selected.length !== 2) {
      setMessage('Pick exactly 2 cards to discard.');
      return;
    }

    // move selected from player to crib
    const newPlayerHand = playerHand.filter(c => !selected.includes(c.id));
    let newCrib = [...crib];
    const discards = playerHand.filter(c => selected.includes(c.id));
    newCrib = newCrib.concat(discards);

    // AI discards two (simple heuristic: discard highest value15)
    const aiSorted = aiHand.slice().sort((a, b) => b.value15 - a.value15);
    const aiDiscards = aiSorted.slice(0, 2);
    const newAiHand = aiHand.filter(c => !aiDiscards.includes(c));
    newCrib = newCrib.concat(aiDiscards);

    // determine starter (cut)
    const restDeck = deck.slice();
    const starterCard = restDeck.shift();

    setPlayerHand(newPlayerHand);
    setAiHand(newAiHand);
    setCrib(newCrib);
    // preserve counting hands (the 4-card hands) for later scoring
    setPlayerCountingHand(newPlayerHand.slice());
    setAiCountingHand(newAiHand.slice());
    setStarter(starterCard);
    setDeck(restDeck);
    setPhase('pegging');
    setMessage('Pegging phase: play cards to the running total. Non-dealer leads.');
    setSelected([]);
    setTurn(dealer === 'player' ? 'ai' : 'player');
    setPegPile([]);
    setPegTotal(0);
  }

  function cardLabel(c) {
    return c.rank + c.suit;
  }

  function playCard(cardId) {
    if (phase !== 'pegging') return;
    if (turn !== 'player') return;

    const card = playerHand.find(c => c.id === cardId);
    if (!card) return;
    if (pegTotal + card.value15 > 31) {
      setMessage('That card would exceed 31.');
      return;
    }

    const newPegTotal = pegTotal + card.value15;
    const newPegPile = pegPile.concat([{ owner: 'player', card }]);

    setPegTotal(newPegTotal);
    setPegPile(newPegPile);
    setLastPegOwner('player');
    const newPlayerHand = playerHand.filter(c => c.id !== cardId);
    setPlayerHand(newPlayerHand);

    const result = scorePegging(newPegPile);
    if (result.pts > 0) {
      setPlayerScore(prev => prev + result.pts);
      triggerPegEffect();
      setMessage('You scored ' + result.description + '.');
    } else {
      setMessage('You played ' + cardLabel(card) + '.');
    }

    // if both players have no cards left, pegging is complete and the player can proceed to scoring
    if (newPlayerHand.length === 0 && aiHand.length === 0) {
      setMessage('Pegging complete — ready to count hands. Press Next Phase.');
      setPhase('counting-ready');
      return;
    }

    // switch to AI turn after a small delay
    setTurn('ai');
    setTimeout(() => aiPlay(newPegTotal, newPegPile), 500);
  }

  function aiPlay(currentTotal, currentPile) {
    // basic strategy: play lowest card that does not bust, else pass
    const playable = aiHand.filter(c => currentTotal + c.value15 <= 31).sort((a, b) => a.value15 - b.value15);
    if (playable.length === 0) {
      const playerPlayable = playerHand.some(c => currentTotal + c.value15 <= 31);
      if (!playerPlayable) {
        const extraGoPts = currentTotal === 31 ? 0 : 1;
        if (extraGoPts && lastPegOwner === 'player') setPlayerScore(prev => prev + extraGoPts);
        if (extraGoPts && lastPegOwner === 'ai') setAiScore(prev => prev + extraGoPts);
        if (extraGoPts > 0) triggerPegEffect();

        if (playerHand.length === 0 && aiHand.length === 0) {
          setMessage('Pegging complete — ready to count hands. Press Next Phase.');
          setPhase('counting-ready');
          return;
        }

        setMessage(
          'AI cannot play. ' +
            (lastPegOwner === 'player' ? 'You' : 'AI') +
            ' score ' +
            (extraGoPts || 2) +
            ' point' +
            ((extraGoPts || 2) > 1 ? 's' : '') +
            ' for ' +
            (currentTotal === 31 ? '31' : 'Go') +
            '.'
        );
        setPegTotal(0);
        setPegPile([]);
        setTurn(lastPegOwner === 'player' ? 'ai' : 'player');
        return;
      }
      setMessage('AI cannot play. Your turn.');
      setTurn('player');
      return;
    }

    const pick = playable[0];
    const newTotal = currentTotal + pick.value15;
    const newPile = currentPile.concat([{ owner: 'ai', card: pick }]);
    const newAiHand = aiHand.filter(c => c.id !== pick.id);
    setAiHand(newAiHand);
    setPegTotal(newTotal);
    setPegPile(newPile);
    setLastPegOwner('ai');

    const result = scorePegging(newPile);
    if (result.pts > 0) {
      setAiScore(prev => prev + result.pts);
      triggerPegEffect();
      setMessage('AI scored ' + result.description + '.');
    } else {
      setMessage('AI played ' + cardLabel(pick) + '.');
    }

    // if both players have no cards left, pegging is complete and the player can proceed to scoring
    if (playerHand.length === 0 && newAiHand.length === 0) {
      setMessage('Pegging complete — ready to count hands. Press Next Phase.');
      setPhase('counting-ready');
      return;
    }

    // back to player
    setTurn('player');
  }

  function scorePegging(pile) {
    // score only pairs and 15/31 in pegging
    const lastCard = pile[pile.length - 1].card;
    let pts = 0;
    const total = pile.reduce((s, p) => s + p.card.value15, 0);
    const details = [];
    if (total === 15) {
      pts += 2;
      details.push('2 points for fifteen');
    }
    if (total === 31) {
      pts += 2;
      details.push('2 points for thirty-one');
    }

    // pairs
    let pairCount = 1;
    for (let i = pile.length - 2; i >= 0; i--) {
      if (pile[i].card.rank === lastCard.rank) pairCount++; else break;
    }
    if (pairCount === 2) {
      pts += 2;
      details.push('2 points for a pair');
    }
    if (pairCount === 3) {
      pts += 6;
      details.push('6 points for a pair royal');
    }
    if (pairCount === 4) {
      pts += 12;
      details.push('12 points for a double pair royal');
    }

    // simple run detection for last 3+ cards
    const values = pile.map(p => p.card.value);
    for (let len = Math.min(values.length, 7); len >= 3; len--) {
      const slice = values.slice(values.length - len);
      const sorted = slice.slice().sort((a, b) => a - b);
      let isRun = true;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) {
          isRun = false; break;
        }
      }
      if (isRun) {
        pts += len;
        details.push(len + ' points for a run of ' + len);
        break;
      }
    }

    return { pts, description: details.length ? details.join(', ') : pts + ' points' };
  }

  function countHandScore(hand, starterCard, isCrib) {
    // compute 15s, pairs, runs, flush, knobs
    const cards = hand.concat(starterCard ? [starterCard] : []);
    // 15s: count combinations that sum to 15 using value15
    const vals = cards.map(c => c.value15);
    let fifteenCount = 0;

    const n = vals.length;
    const combos = 1 << n;
    for (let mask = 1; mask < combos; mask++) {
      let sum = 0;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += vals[i];
      if (sum === 15) fifteenCount++;
    }

    // pairs
    let pairPoints = 0;
    const ranks = cards.map(c => c.rank);
    const rankCounts = {};
    for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
    Object.values(rankCounts).forEach(cnt => { if (cnt > 1) pairPoints += (cnt * (cnt - 1)); });

    // runs: find longest run using rank numeric value
    const values = cards.map(c => c.value);
    // check all subsets for runs length >=3 and sum count multiplicity
    let runPoints = 0;
    for (let len = 5; len >= 3; len--) {
      // brute force: check all combinations of size len
      const idxs = combIndices(cards.length, len);
      for (const idx of idxs) {
        const seq = idx.map(i => values[i]).slice().sort((a, b) => a - b);
        let ok = true;
        for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1] + 1) { ok = false; break; }
        if (ok) runPoints += len;
      }
      if (runPoints > 0) break;
    }

    // flush (all same suit) - if hand cards (not counting starter) are same suit
    let flushPoints = 0;
    const suits = hand.map(c => c.suit);
    if (suits.every(s => s === suits[0])) {
      flushPoints = 4 + (starterCard && starterCard.suit === suits[0] ? 1 : 0);
      if (isCrib && !(starterCard && starterCard.suit === suits[0])) flushPoints = 0; // crib flush requires starter match
    }

    // knobs: jack in hand same suit as starter
    let knobs = 0;
    if (starterCard) {
      for (const c of hand) if (c.rank === 'J' && c.suit === starterCard.suit) knobs = 1;
    }

    const total = fifteenCount * 2 + pairPoints + runPoints + flushPoints + knobs;
    return total;
  }

  function combIndices(n, k) {
    const results = [];
    function helper(start, combo) {
      if (combo.length === k) { results.push(combo.slice()); return; }
      for (let i = start; i < n; i++) { combo.push(i); helper(i + 1, combo); combo.pop(); }
    }
    helper(0, []);
    return results;
  }

  function finishHandCount() {
    // start the counting sequence (non-dealer first, then dealer, then crib)
    startCounting();
  }

  function countSingle(who) {
    if (who === 'player') {
      const pts = countHandScore(playerCountingHand, starter, false);
      setPlayerScore(prev => prev + pts);
      setMessage('You score ' + pts + ' points for your hand.');
    } else if (who === 'ai') {
      const pts = countHandScore(aiCountingHand, starter, false);
      setAiScore(prev => prev + pts);
      setMessage('AI scores ' + pts + ' points for its hand.');
    }
  }

  function startCounting() {
    setPhase('counting');
    const nonDealer = dealer === 'player' ? 'ai' : 'player';
    const first = nonDealer;
    const second = dealer;
    setMessage((first === 'player' ? 'You' : 'AI') + ' count first.');

    // first count
    setTimeout(() => {
      countSingle(first);
      // second count
      setTimeout(() => {
        countSingle(second);
        // finally crib counts for dealer
        setTimeout(() => {
          const cribPts = countHandScore(crib, starter, true);
          if (dealer === 'player') setPlayerScore(prev => prev + cribPts); else setAiScore(prev => prev + cribPts);
          setMessage('Crib scored ' + cribPts + ' points for ' + dealer + '.');
          setPhase('idle');
        }, 1000);
      }, 1000);
    }, 800);
  }

  const containerStyle = {
    maxWidth: '980px',
    margin: '0 auto',
    padding: '24px',
    color: '#f7f9fc',
  };

  const headerStyle = {
    fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
    margin: '0 0 16px',
  };

  const panelStyle = {
    backgroundColor: '#0f1b35',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
  };

  const cardStyle = {
    display: 'inline-block',
    padding: '8px 10px',
    margin: '6px',
    borderRadius: '8px',
    backgroundColor: '#e6edf6',
    color: '#071326',
    border: '1px solid rgba(7,19,38,0.12)',
    cursor: 'pointer',
  };

  const scoreRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  };

  const playerBoxStyle = {
    flex: '1 1 240px',
    backgroundColor: '#152545',
    borderRadius: '12px',
    padding: '16px',
    color: '#f7f9fc',
  };

  const playerLabelStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.9rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#93c5fd',
  };

  const dealerBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '999px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
  };

  const pegBoardStyle = {
    backgroundColor: '#091323',
    borderRadius: '14px',
    padding: '14px',
    marginTop: '12px',
    transition: 'transform 220ms ease, box-shadow 220ms ease, background-color 220ms ease',
    transform: pegEffect ? 'translateY(-2px) scale(1.02)' : 'translateY(0)',
    boxShadow: pegEffect ? '0 0 0 4px rgba(59, 130, 246, 0.18)' : 'none',
  };

  const pegDotStyle = {
    fontSize: '1.4rem',
    transition: 'transform 180ms ease',
    transform: pegEffect ? 'scale(1.3)' : 'scale(1)',
  };

  function triggerPegEffect() {
    setPegEffect(true);
    window.clearTimeout(triggerPegEffect.timer);
    triggerPegEffect.timer = window.setTimeout(() => setPegEffect(false), 360);
  }

  function playerGo() {
    if (phase !== 'pegging' || turn !== 'player') return;
    // player declares Go — switch to AI and let AI attempt plays
    setMessage('You said Go. AI will attempt to play; if it cannot move, the last player scores a point for Go.');
    setTurn('ai');
    setTimeout(() => aiPlay(pegTotal, pegPile), 400);
  }

  return (
    <main style={containerStyle}>
      <ServiceWorkerRegister />
      <h1 style={headerStyle}>Cribbage: Single-player vs AI</h1>

      <div style={panelStyle}>
        <div style={scoreRowStyle}>
          <div style={playerBoxStyle}>
            <div style={playerLabelStyle}>YOU</div>
            {dealer === 'player' && <div style={dealerBadgeStyle}>DEALER</div>}
            <div style={{ fontSize: '2rem', marginTop: '10px' }}>{playerScore}</div>
          </div>
          <div style={playerBoxStyle}>
            <div style={playerLabelStyle}>AI</div>
            {dealer === 'ai' && <div style={dealerBadgeStyle}>DEALER</div>}
            <div style={{ fontSize: '2rem', marginTop: '10px' }}>{aiScore}</div>
          </div>
        </div>
        <div style={pegBoardStyle}>
          <div style={{ marginBottom: '8px', color: '#93c5fd', fontWeight: 700 }}>Pegboard</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            {[0, 1, 2, 3].map(i => (
              <span key={i} style={pegDotStyle}>⚫</span>
            ))}
          </div>
        </div>
      </div>

      <div style={panelStyle}>
        <div style={{ marginBottom: '8px' }}>Phase: {phase}</div>
        <div style={{ marginBottom: '8px' }}>Dealer: {dealer}</div>
        <div style={{ marginBottom: '8px' }}>Starter: {starter ? cardLabel(starter) : '—'}</div>
        <div style={{ marginBottom: '8px' }}>Message: {message}</div>

        {phase === 'idle' && (
          <div>
            <button onClick={deal} style={{ marginRight: '8px' }}>Deal</button>
            <button onClick={resetGame}>Reset Game</button>
          </div>
        )}

        {phase === 'discard' && (
          <div>
            <div style={{ marginBottom: '8px' }}>Your hand — select 2 to discard:</div>
            <div>
              {playerHand.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleSelect(c.id)}
                  style={{
                    ...cardStyle,
                    backgroundColor: selected.includes(c.id) ? '#fee2e2' : cardStyle.backgroundColor,
                    border: selected.includes(c.id) ? '2px solid #dc2626' : cardStyle.border,
                  }}
                >
                  {cardLabel(c)}
                </button>
              ))}
            </div>
            <div style={{ marginTop: '8px' }}>
              <button onClick={finishDiscard}>Finish Discard</button>
            </div>
          </div>
        )}

        {phase === 'pegging' && (
          <div>
            <div style={{ marginBottom: '8px' }}>Running total: {pegTotal}</div>
            <div style={{ marginBottom: '8px' }}>Pile: {pegPile.map(p => (p.owner[0] + ':' + cardLabel(p.card))).join(', ')}</div>

            <div style={{ marginBottom: '8px' }}>Your hand:</div>
            <div>
              {playerHand.map(c => (
                <button key={c.id} onClick={() => playCard(c.id)} style={cardStyle}>{cardLabel(c)}</button>
              ))}
            </div>
            <div style={{ marginTop: '8px' }}>
              <button onClick={playerGo} style={{ marginLeft: 8 }}>Go</button>
            </div>
          </div>
        )}

        {phase === 'counting-ready' && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ marginBottom: '8px' }}>Pegging is complete. Press Next Phase to count hands and score the crib.</div>
            <button onClick={startCounting}>Next Phase: Count Hands</button>
          </div>
        )}
      </div>
    </main>
  );
}
