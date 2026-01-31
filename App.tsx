
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameState, Player, Question, Answer } from './types';
import { QUESTIONS_BANK, WINNING_SCORE } from './constants';
import { Button } from './components/Button';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>(GameState.HOME);
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostIndex, setHostIndex] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<Answer[]>([]);
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  
  // Shuffled answers for judgment (to avoid re-shuffling on every render and fix hook violation)
  const [shuffledAnswers, setShuffledAnswers] = useState<Answer[]>([]);
  
  // Input states
  const [tempName, setTempName] = useState('');
  const [manualQuestion, setManualQuestion] = useState('');
  const [currentPlayerIndexInRound, setCurrentPlayerIndexInRound] = useState(0);
  const [activeResponses, setActiveResponses] = useState<string[]>(['', '']);
  const [winnerRevealedId, setWinnerRevealedId] = useState<number | null>(null);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Derived state
  const currentHost = players[hostIndex];
  const participants = useMemo(() => players.filter((_, idx) => idx !== hostIndex), [players, hostIndex]);
  const isLastPlayerInRound = currentPlayerIndexInRound === participants.length - 1;

  const manualSlotsCount = useMemo(() => {
    return (manualQuestion.match(/_{3,}/g) || []).length;
  }, [manualQuestion]);

  // Handle shuffling answers when entering judgment phase
  useEffect(() => {
    if (gameState === GameState.JUDGMENT) {
      const shuffled = [...currentAnswers].sort(() => Math.random() - 0.5);
      setShuffledAnswers(shuffled);
    }
  }, [gameState, currentAnswers]);

  // Actions
  const startNewGame = () => {
    setPlayers([]);
    setHostIndex(0);
    setGameState(GameState.SETUP_HOST);
  };

  const setHost = () => {
    if (!tempName.trim()) return;
    setPlayers([{ name: tempName.trim(), score: 0 }]);
    setTempName('');
    setGameState(GameState.ADD_PLAYERS);
  };

  const addPlayer = () => {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    if (players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
        alert("Este nome já está em uso!");
        return;
    }
    setPlayers(prev => [...prev, { name: trimmed, score: 0 }]);
    setTempName('');
  };

  const startGameMatch = () => {
    if (players.length < 3) {
      alert("Adicione pelo menos mais 2 jogadores (mínimo 3 pessoas no total).");
      return;
    }
    setGameState(GameState.CREATE_QUESTION);
  };

  const handleRandomQuestion = () => {
    let available = QUESTIONS_BANK.filter(q => !usedQuestions.includes(q));
    if (available.length === 0) {
      setUsedQuestions([]);
      available = [...QUESTIONS_BANK];
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    setUsedQuestions(prev => [...prev, picked]);
    setCurrentQuestion({ text: picked, slots: 1 });
    setCurrentAnswers([]);
    setCurrentPlayerIndexInRound(0);
    setGameState(GameState.ANSWER_ROUND);
  };

  const handleManualQuestion = () => {
    if (!manualQuestion.trim() || manualSlotsCount === 0) {
      alert("Escreva uma pergunta e adicione pelo menos um espaço (______).");
      return;
    }
    if (manualSlotsCount > 2) {
      alert("O máximo de espaços permitidos é 2.");
      return;
    }
    setCurrentQuestion({ 
      text: manualQuestion.trim(), 
      slots: manualSlotsCount 
    });
    setCurrentAnswers([]);
    setCurrentPlayerIndexInRound(0);
    setGameState(GameState.ANSWER_ROUND);
  };

  const addPlaceholder = () => {
    if (manualSlotsCount >= 2) return;
    const textArea = textAreaRef.current;
    const placeholder = "______";
    if (textArea) {
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const text = manualQuestion;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + placeholder + after;
      setManualQuestion(newText);
      setTimeout(() => {
        textArea.focus();
        const newCursorPos = start + placeholder.length;
        textArea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      setManualQuestion(prev => prev + placeholder);
    }
  };

  const submitAnswer = () => {
    const currentParticipant = participants[currentPlayerIndexInRound];
    const playerIndexInFullList = players.findIndex(p => p.name === currentParticipant.name);
    const cleanAnswers = activeResponses.slice(0, currentQuestion?.slots).map(a => a.trim());
    
    if (cleanAnswers.some(a => !a)) {
        alert("Preencha todos os espaços!");
        return;
    }

    const newAnswer: Answer = {
      playerId: playerIndexInFullList,
      texts: cleanAnswers
    };

    setCurrentAnswers(prev => [...prev, newAnswer]);
    setActiveResponses(['', '']);

    if (isLastPlayerInRound) {
      setGameState(GameState.WAIT_HOST);
    } else {
      setCurrentPlayerIndexInRound(prev => prev + 1);
    }
  };

  const pickWinner = (playerId: number) => {
    setWinnerRevealedId(playerId);
    setGameState(GameState.REVEAL);
  };

  const nextRound = () => {
    if (winnerRevealedId === null) return;
    
    const updatedPlayers = [...players];
    updatedPlayers[winnerRevealedId].score += 1;
    
    if (updatedPlayers[winnerRevealedId].score >= WINNING_SCORE) {
      setPlayers(updatedPlayers);
      setGameState(GameState.VICTORY);
    } else {
      setPlayers(updatedPlayers);
      setHostIndex(winnerRevealedId); // The winner becomes the next host
      setWinnerRevealedId(null);
      setManualQuestion('');
      setCurrentPlayerIndexInRound(0);
      setGameState(GameState.CREATE_QUESTION);
    }
  };

  const restartGame = (keepPlayers: boolean) => {
    if (keepPlayers) {
      const resetPlayers = players.map(p => ({ ...p, score: 0 }));
      setPlayers(resetPlayers);
      setHostIndex(0);
      setManualQuestion('');
      setGameState(GameState.CREATE_QUESTION);
    } else {
      startNewGame();
    }
  };

  // Renderers
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-12">
      <div className="space-y-4">
        <h1 className="text-8xl font-black tracking-tighter">P.Q.P.</h1>
        <p className="text-xl font-bold uppercase tracking-widest text-gray-400">Pra Quem Pode</p>
      </div>
      <div className="w-full max-w-sm">
        <Button onClick={startNewGame}>NOVO JOGO</Button>
      </div>
      <p className="text-xs uppercase font-bold text-gray-500">Jogo incrível com alto risco de dependência</p>
    </div>
  );

  const renderSetupHost = () => (
    <div className="flex flex-col h-full px-6 py-12 space-y-8">
      <h2 className="text-4xl font-black tracking-tight uppercase">Defina o Anfitrião</h2>
      <div className="flex flex-col space-y-4">
        <label className="text-sm font-bold uppercase text-gray-400">Nome do Anfitrião</label>
        <input 
          type="text" 
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          placeholder="Ex: Carlos"
          className="bg-zinc-900 border-2 border-zinc-800 p-4 rounded-xl text-2xl font-bold focus:border-green-500 outline-none transition-all"
        />
        <Button onClick={setHost}>DEFINIR</Button>
      </div>
    </div>
  );

  const renderAddPlayers = () => (
    <div className="flex flex-col h-full px-6 py-12 space-y-8">
      <div className="space-y-2">
        <h2 className="text-4xl font-black tracking-tight uppercase">Jogadores</h2>
        <p className="text-sm text-gray-400 font-bold uppercase">Anfitrião: {players[0]?.name}</p>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {players.slice(1).map((p, i) => (
          <div key={i} className="bg-zinc-900 p-4 rounded-xl flex justify-between items-center border border-zinc-800">
            <span className="font-bold text-xl">{p.name}</span>
            <span className="text-zinc-500">#{i + 1}</span>
          </div>
        ))}
        {players.length === 1 && (
            <div className="h-20 flex items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-600 font-bold">
                NENHUM JOGADOR ADICIONADO
            </div>
        )}
      </div>

      <div className="space-y-4">
        <input 
          type="text" 
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          placeholder="Nome do próximo jogador"
          className="bg-zinc-900 border-2 border-zinc-800 w-full p-4 rounded-xl text-xl font-bold focus:border-green-500 outline-none"
        />
        <div className="grid grid-cols-1 gap-4">
          <Button variant="secondary" onClick={addPlayer}>PRÓXIMO JOGADOR</Button>
          <Button onClick={startGameMatch} disabled={players.length < 3}>COMEÇAR PARTIDA</Button>
        </div>
      </div>
    </div>
  );

  const renderCreateQuestion = () => (
    <div className="flex flex-col h-full px-6 py-12 space-y-8">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-3xl font-black uppercase tracking-tight">Vez de {currentHost.name}</h2>
          <p className="text-sm font-bold text-green-500 uppercase tracking-widest">Anfitrião da rodada</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-zinc-500 uppercase">Pontos</p>
          <div className="flex flex-wrap gap-1 justify-end">
            {players.map((p, idx) => (
                <div key={idx} className="bg-zinc-900 px-2 py-1 rounded text-[10px] font-bold border border-zinc-800">
                    {p.name}: {p.score}
                </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-6 flex-1 overflow-y-auto">
        <div className="space-y-4">
          <label className="text-xs font-bold text-zinc-500 uppercase">Crie sua pergunta</label>
          <div className="space-y-2">
            <textarea 
              ref={textAreaRef}
              value={manualQuestion}
              onChange={(e) => setManualQuestion(e.target.value)}
              placeholder="Ex: Eu nao quero _____ porque _______"
              className="w-full bg-zinc-900 border-2 border-zinc-800 p-4 rounded-xl text-xl font-bold h-32 outline-none focus:border-green-500"
            />
            <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <span className="font-bold text-zinc-400">Espaços: {manualSlotsCount}</span>
              <Button 
                variant="secondary" 
                className="w-auto py-2 px-4 text-sm" 
                onClick={addPlaceholder}
                disabled={manualSlotsCount >= 2}
              >
                + RESPOSTA (______)
              </Button>
            </div>
            <Button variant="primary" onClick={handleManualQuestion} disabled={!manualQuestion.trim() || manualSlotsCount === 0 || manualSlotsCount > 2}>
                PRONTO
            </Button>
          </div>
        </div>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-black px-4 text-zinc-600 font-bold">OU</span></div>
        </div>

        <div className="space-y-4">
          <label className="text-xs font-bold text-zinc-500 uppercase">Sugestão Aleatória</label>
          <Button variant="secondary" onClick={handleRandomQuestion}>SORTEAR PERGUNTA</Button>
        </div>
      </div>
    </div>
  );

  const renderAnswerRound = () => {
    const currentParticipant = participants[currentPlayerIndexInRound];
    if (!currentQuestion) return null;

    return (
      <div className="flex flex-col h-full px-6 py-12 space-y-8">
        <div className="space-y-2 text-center">
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Passe o celular para</p>
            <h2 className="text-5xl font-black uppercase text-green-500 tracking-tight">{currentParticipant.name}</h2>
        </div>

        <div className="bg-zinc-900 p-8 rounded-3xl border-2 border-zinc-800 shadow-2xl">
            <p className="text-2xl font-bold leading-relaxed">{currentQuestion.text}</p>
        </div>

        <div className="space-y-6 flex-1">
          {Array.from({ length: currentQuestion.slots }).map((_, idx) => (
            <div key={idx} className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase">Complete o espaço {idx + 1}</label>
                <input 
                    type="text"
                    value={activeResponses[idx]}
                    onChange={(e) => {
                        const newRes = [...activeResponses];
                        newRes[idx] = e.target.value;
                        setActiveResponses(newRes);
                    }}
                    placeholder="..."
                    className="w-full bg-zinc-900 border-2 border-zinc-800 p-6 rounded-2xl text-2xl font-black outline-none focus:border-green-500"
                />
            </div>
          ))}
        </div>

        <Button onClick={submitAnswer}>CONFIRMAR</Button>
      </div>
    );
  };

  const renderWaitHost = () => (
    <div className="flex flex-col items-center justify-center h-full px-6 space-y-12 text-center">
      <div className="space-y-4">
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Respostas enviadas!</p>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Passe o celular de volta para</p>
          <h2 className="text-7xl font-black uppercase tracking-tighter text-green-500">{currentHost.name}</h2>
      </div>
      <div className="w-full max-w-sm">
          <Button onClick={() => setGameState(GameState.JUDGMENT)}>ABRIR RESPOSTAS</Button>
      </div>
    </div>
  );

  const renderJudgment = () => {
    if (!currentQuestion) return null;

    return (
      <div className="flex flex-col h-full bg-white text-black px-6 py-12 space-y-8">
        <div className="space-y-2 flex-shrink-0">
            <h2 className="text-4xl font-black uppercase leading-tight tracking-tight">Anfitrião: {currentHost.name}</h2>
            <p className="font-bold text-zinc-500 uppercase tracking-tighter">Escolha a melhor frase</p>
        </div>

        <div className="space-y-6 overflow-y-auto pb-12 flex-1 pr-1">
            {shuffledAnswers.map((ans, i) => {
                let fullSentence = currentQuestion.text;
                ans.texts.forEach(t => {
                    fullSentence = fullSentence.replace(/_{3,}/, `<strong class="text-black underline decoration-green-500 decoration-[6px] underline-offset-8 px-2 uppercase font-black">${t}</strong>`);
                });

                return (
                    <div key={i} className="flex flex-col gap-6 p-8 bg-zinc-50 border-2 border-zinc-200 rounded-3xl shadow-lg transform transition-transform hover:scale-[1.01]">
                        <div 
                            className="text-2xl leading-relaxed text-zinc-900" 
                            dangerouslySetInnerHTML={{ __html: fullSentence }} 
                        />
                        <Button onClick={() => pickWinner(ans.playerId)}>VOTAR NESTA</Button>
                    </div>
                );
            })}
        </div>
      </div>
    );
  };

  const renderReveal = () => {
    if (winnerRevealedId === null) return null;
    const winner = players[winnerRevealedId];

    return (
      <div className="flex flex-col items-center justify-center h-full px-6 space-y-12 text-center">
        <div className="space-y-4">
            <p className="text-sm font-bold text-green-500 uppercase tracking-[0.5em]">O autor da frase foi...</p>
            <h2 className="text-7xl font-black uppercase tracking-tighter">{winner.name}</h2>
        </div>
        <div className="bg-zinc-900 p-8 rounded-full border-4 border-green-500 w-48 h-48 flex items-center justify-center">
            <span className="text-6xl font-black text-green-500">+1</span>
        </div>
        <div className="w-full max-w-sm">
            <Button onClick={nextRound}>PRÓXIMA RODADA</Button>
        </div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest">{winner.name} será o próximo Anfitrião!</p>
      </div>
    );
  };

  const renderVictory = () => {
    const winner = players.find(p => p.score >= WINNING_SCORE);
    if (!winner) return null;

    return (
      <div className="flex flex-col items-center justify-center h-full px-6 space-y-12 text-center bg-green-500 text-black">
        <div className="space-y-4">
            <h2 className="text-9xl font-black tracking-tighter uppercase leading-none">VENCEDOR!</h2>
            <p className="text-2xl font-black uppercase">P.Q.P. - O JOGO É DELE</p>
        </div>
        
        <div className="bg-black text-white p-12 rounded-3xl w-full max-w-sm rotate-2 shadow-2xl">
            <h3 className="text-5xl font-black uppercase">{winner.name}</h3>
            <p className="text-xl font-bold mt-2 uppercase tracking-widest">É O MAIOR DE TODOS</p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4 mt-8">
            <Button variant="secondary" onClick={() => restartGame(true)}>JOGAR NOVAMENTE</Button>
            <Button variant="secondary" onClick={() => restartGame(false)} className="bg-white text-black border-zinc-400">NOVOS JOGADORES</Button>
        </div>
      </div>
    );
  };

  const renderState = () => {
    switch (gameState) {
      case GameState.HOME: return renderHome();
      case GameState.SETUP_HOST: return renderSetupHost();
      case GameState.ADD_PLAYERS: return renderAddPlayers();
      case GameState.CREATE_QUESTION: return renderCreateQuestion();
      case GameState.ANSWER_ROUND: return renderAnswerRound();
      case GameState.WAIT_HOST: return renderWaitHost();
      case GameState.JUDGMENT: return renderJudgment();
      case GameState.REVEAL: return renderReveal();
      case GameState.VICTORY: return renderVictory();
      default: return renderHome();
    }
  };

  return (
    <div className="h-screen w-screen max-w-lg mx-auto bg-black flex flex-col relative overflow-hidden">
      <main className="flex-1 overflow-hidden">
        {renderState()}
      </main>
      <div className="h-16 bg-zinc-950 border-t border-zinc-900 flex items-center justify-center text-[10px] text-zinc-700 font-bold uppercase tracking-widest flex-shrink-0">
        Espaço Publicitário
      </div>
    </div>
  );
};

export default App;
