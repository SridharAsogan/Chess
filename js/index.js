/**
 * War on Chess - Tactical Arena Engine
 * Features:
 * - PeerJS P2P Real-Time Multiplayer with Aggressive Host Disconnect Detection
 * - WebRTC ICE Connection State Watcher (Immediate Drop Detection)
 * - Mobile Lifecycle Events (pagehide, beforeunload)
 * - AI Engine (Minimax with Positional Tables & Move Ordering)
 * - Captured Pieces Tray with Material Score Advantage
 * - Clean Casual Turn-Based HUD
 * - Custom Modal System with Board Review Option
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM References
  const tabAi = document.getElementById('tabAi');
  const tabFriend = document.getElementById('tabFriend');
  const aiOptions = document.getElementById('aiOptions');
  const friendOptions = document.getElementById('friendOptions');
  const btnStartGame = document.getElementById('btnStartGame');
  const btnExitLobby = document.getElementById('btnExitLobby');
  const btnResign = document.getElementById('btnResign');
  const btnDraw = document.getElementById('btnDraw');
  const screenLobby = document.getElementById('screenLobby');
  const screenArena = document.getElementById('screenArena');
  const boardEl = document.getElementById('chessBoard');

  // P2P Room DOM
  const btnCreateRoom = document.getElementById('btnCreateRoom');
  const btnCopyCode = document.getElementById('btnCopyCode');
  const btnJoinRoom = document.getElementById('btnJoinRoom');
  const roomCodeDisplay = document.getElementById('roomCodeDisplay');
  const createdCodeText = document.getElementById('createdCodeText');
  const hostStatusMsg = document.getElementById('hostStatusMsg');
  const joinRoomCodeInput = document.getElementById('joinRoomCode');
  const joinStatusMsg = document.getElementById('joinStatusMsg');

  // HUD DOM
  const playerNameDisplay = document.getElementById('playerNameDisplay');
  const oppName = document.getElementById('oppName');
  const commanderBadge = document.getElementById('commanderBadge');
  const oppBadge = document.getElementById('oppBadge');
  const playerStatusEl = document.getElementById('playerStatus');
  const oppStatusEl = document.getElementById('oppStatus');
  const playerCapturedEl = document.getElementById('playerCaptured');
  const oppCapturedEl = document.getElementById('oppCaptured');

  // Modal Elements
  const gameModal = document.getElementById('gameModal');
  const modalIcon = document.getElementById('modalIcon');
  const modalTitle = document.getElementById('modalTitle');
  const modalMsg = document.getElementById('modalMsg');
  const btnReviewBoard = document.getElementById('btnReviewBoard');
  const btnModalAction = document.getElementById('btnModalAction');
  const checkToast = document.getElementById('checkToast');

  // Game States
  let game = new Chess();
  let playerSide = 'w';
  let aiDifficulty = 'grandmaster';
  let isAiMode = true;
  let isGameOver = false;

  let selectedSquare = null;
  let validMoves = [];
  let lastMove = null;

  // WebRTC P2P & Connection Watchdog States
  let peer = null;
  let conn = null;
  let isHost = false;
  let heartbeatTimer = null;
  let lastOpponentPing = Date.now();

  const PIECE_UNICODE = {
    w: { p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔' },
    b: { p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' }
  };

  const PIECE_VALUES = {
    p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000
  };

  const STARTING_PIECES = { p: 8, r: 2, n: 2, b: 2, q: 1 };

  const PAWN_TABLE = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 28, 28, 10,  5,  5],
    [0,  0,  0, 25, 25,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-25,-25, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ];

  const KNIGHT_TABLE = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 25, 25, 15,  0,-30],
    [-30,  5, 15, 25, 25, 15,  5,-30],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ];

  const BISHOP_TABLE = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  0, 10, 15, 15, 10,  0,-10],
    [-10,  5,  5, 15, 15,  5,  5,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ];

  const ROOK_TABLE = [
    [0,  0,  0,  5,  5,  0,  0,  0],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ];

  // Tab Switch
  tabAi.addEventListener('click', () => {
    tabAi.classList.add('active');
    tabFriend.classList.remove('active');
    aiOptions.classList.add('active');
    friendOptions.classList.remove('active');
    isAiMode = true;
  });

  tabFriend.addEventListener('click', () => {
    tabFriend.classList.add('active');
    tabAi.classList.remove('active');
    friendOptions.classList.add('active');
    aiOptions.classList.remove('active');
    isAiMode = false;
  });

  function coordsToSquare(row, col) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const rank = 8 - row;
    return `${files[col]}${rank}`;
  }

  /* ---------------- CAPTURED PIECES LOGIC ---------------- */
  function updateCapturedPieces() {
    playerCapturedEl.innerHTML = '';
    oppCapturedEl.innerHTML = '';

    const currentCounts = {
      w: { p: 0, r: 0, n: 0, b: 0, q: 0 },
      b: { p: 0, r: 0, n: 0, b: 0, q: 0 }
    };

    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type !== 'k') {
          currentCounts[p.color][p.type]++;
        }
      }
    }

    const capturedWhite = [];
    const capturedBlack = [];

    const pieceOrder = ['q', 'r', 'b', 'n', 'p'];
    let whiteScore = 0;
    let blackScore = 0;

    for (let type of pieceOrder) {
      const lostWhite = STARTING_PIECES[type] - currentCounts.w[type];
      for (let i = 0; i < lostWhite; i++) {
        capturedWhite.push(type);
        blackScore += PIECE_VALUES[type];
      }

      const lostBlack = STARTING_PIECES[type] - currentCounts.b[type];
      for (let i = 0; i < lostBlack; i++) {
        capturedBlack.push(type);
        whiteScore += PIECE_VALUES[type];
      }
    }

    const playerCaptured = (playerSide === 'w') ? capturedBlack : capturedWhite;
    const oppCaptured = (playerSide === 'w') ? capturedWhite : capturedBlack;
    const oppColor = (playerSide === 'w') ? 'w' : 'b';

    playerCaptured.forEach(type => {
      const span = document.createElement('span');
      span.className = `captured-piece piece-${oppColor}`;
      span.innerText = PIECE_UNICODE[oppColor][type];
      playerCapturedEl.appendChild(span);
    });

    oppCaptured.forEach(type => {
      const span = document.createElement('span');
      span.className = `captured-piece piece-${playerSide}`;
      span.innerText = PIECE_UNICODE[playerSide][type];
      oppCapturedEl.appendChild(span);
    });

    const diff = (playerSide === 'w') ? (whiteScore - blackScore) : (blackScore - whiteScore);
    if (diff > 0) {
      const diffSpan = document.createElement('span');
      diffSpan.className = 'material-diff';
      diffSpan.innerText = `+${Math.floor(diff / 100)}`;
      playerCapturedEl.appendChild(diffSpan);
    } else if (diff < 0) {
      const diffSpan = document.createElement('span');
      diffSpan.className = 'material-diff';
      diffSpan.innerText = `+${Math.floor(Math.abs(diff) / 100)}`;
      oppCapturedEl.appendChild(diffSpan);
    }
  }

  /* ---------------- BOARD RENDER ---------------- */
  function renderBoard() {
    boardEl.innerHTML = '';
    const isFlipped = (playerSide === 'b');

    const rowOrder = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const colOrder = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

    if (game.in_check() && !game.game_over()) {
      checkToast.style.display = 'block';
    } else {
      checkToast.style.display = 'none';
    }

    for (let r of rowOrder) {
      for (let c of colOrder) {
        const sqName = coordsToSquare(r, c);
        const squareEl = document.createElement('div');
        const isLight = (r + c) % 2 === 0;

        squareEl.className = `chess-square ${isLight ? 'sq-light' : 'sq-dark'}`;
        squareEl.dataset.square = sqName;

        if (lastMove && (lastMove.from === sqName || lastMove.to === sqName)) {
          squareEl.classList.add('sq-last-move');
        }

        if (selectedSquare === sqName) {
          squareEl.classList.add('sq-selected');
        }

        const piece = game.get(sqName);
        if (piece && piece.type === 'k' && piece.color === game.turn() && game.in_check()) {
          squareEl.classList.add('sq-check');
        }

        const targetMove = validMoves.find(m => m.to === sqName);
        if (targetMove) {
          if (targetMove.captured) {
            squareEl.classList.add('sq-valid-capture');
          } else {
            squareEl.classList.add('sq-valid-dot');
          }
        }

        if (piece) {
          const pieceEl = document.createElement('span');
          pieceEl.className = `chess-piece piece-${piece.color}`;
          pieceEl.innerText = PIECE_UNICODE[piece.color][piece.type];
          squareEl.appendChild(pieceEl);
        }

        squareEl.addEventListener('click', () => handleSquareClick(sqName));
        boardEl.appendChild(squareEl);
      }
    }
  }

  function handleSquareClick(square) {
    if (isGameOver || game.game_over()) return;
    if (game.turn() !== playerSide) return;

    const move = validMoves.find(m => m.to === square);
    if (selectedSquare && move) {
      const movePayload = {
        from: selectedSquare,
        to: square,
        promotion: 'q'
      };

      const moveResult = game.move(movePayload);

      if (moveResult) {
        lastMove = { from: moveResult.from, to: moveResult.to };

        if (!isAiMode && conn && conn.open) {
          conn.send({ type: 'MOVE', move: movePayload });
        }
      }

      selectedSquare = null;
      validMoves = [];
      renderBoard();
      updateTurnStatus();
      updateCapturedPieces();

      if (game.game_over()) {
        checkGameStatus();
        return;
      }

      if (isAiMode && game.turn() !== playerSide) {
        setTimeout(triggerAiMove, 250);
      }
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      selectedSquare = square;
      validMoves = game.moves({ square: square, verbose: true });
    } else {
      selectedSquare = null;
      validMoves = [];
    }

    renderBoard();
  }

  /* ---------------- AI ENGINE ---------------- */
  function evaluateBoard(boardState) {
    let totalScore = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = coordsToSquare(r, c);
        const p = boardState.get(sq);
        if (p) {
          let score = PIECE_VALUES[p.type] || 0;
          const rowIdx = p.color === 'w' ? r : 7 - r;

          if (p.type === 'p') score += PAWN_TABLE[rowIdx][c];
          else if (p.type === 'n') score += KNIGHT_TABLE[rowIdx][c];
          else if (p.type === 'b') score += BISHOP_TABLE[rowIdx][c];
          else if (p.type === 'r') score += ROOK_TABLE[rowIdx][c];

          totalScore += (p.color === 'w') ? score : -score;
        }
      }
    }
    if (boardState.in_check()) {
      totalScore += (boardState.turn() === 'w') ? -60 : 60;
    }
    return totalScore;
  }

  function orderMoves(moves) {
    return moves.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      if (a.captured) {
        scoreA = (PIECE_VALUES[a.captured] * 10) - (PIECE_VALUES[a.piece] || 0);
      }
      if (b.captured) {
        scoreB = (PIECE_VALUES[b.captured] * 10) - (PIECE_VALUES[b.piece] || 0);
      }
      if (a.promotion) scoreA += 900;
      if (b.promotion) scoreB += 900;
      return scoreB - scoreA;
    });
  }

  function minimax(depth, isMaximizing, alpha, beta) {
    if (depth === 0 || game.game_over()) {
      return evaluateBoard(game);
    }

    let moves = game.moves({ verbose: true });
    moves = orderMoves(moves);

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (let m of moves) {
        game.move(m);
        const score = minimax(depth - 1, false, alpha, beta);
        game.undo();
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (let m of moves) {
        game.move(m);
        const score = minimax(depth - 1, true, alpha, beta);
        game.undo();
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minScore;
    }
  }

  function triggerAiMove() {
    if (isGameOver || game.game_over()) return;

    let moves = game.moves({ verbose: true });
    if (moves.length === 0) return;

    moves = orderMoves(moves);
    let bestMove = null;
    const isAiWhite = (playerSide === 'b');

    let depth = 1;
    if (aiDifficulty === 'warrior') depth = 2;
    if (aiDifficulty === 'grandmaster' || aiDifficulty === 'warlord') depth = 3;

    if (aiDifficulty === 'novice') {
      const cap = moves.filter(m => m.captured);
      bestMove = cap.length > 0 ? cap[0] : moves[Math.floor(Math.random() * moves.length)];
    } else {
      let bestScore = isAiWhite ? -Infinity : Infinity;

      for (let m of moves) {
        game.move(m);
        if (game.in_checkmate()) {
          game.undo();
          bestMove = m;
          break;
        }

        const score = minimax(depth - 1, !isAiWhite, -Infinity, Infinity);
        game.undo();

        if (isAiWhite) {
          if (score > bestScore) {
            bestScore = score;
            bestMove = m;
          }
        } else {
          if (score < bestScore) {
            bestScore = score;
            bestMove = m;
          }
        }
      }
    }

    if (!bestMove) bestMove = moves[0];

    const aiMoveResult = game.move(bestMove);
    if (aiMoveResult) {
      lastMove = { from: aiMoveResult.from, to: aiMoveResult.to };
    }

    renderBoard();
    updateTurnStatus();
    updateCapturedPieces();
    checkGameStatus();
  }

  /* ---------------- STATUS & MODAL CONTROLLER ---------------- */
  function updateTurnStatus() {
    const isPlayerTurn = (game.turn() === playerSide);

    if (isPlayerTurn) {
      playerStatusEl.innerText = "YOUR TURN";
      playerStatusEl.classList.add('active-turn');
      oppStatusEl.innerText = "WAITING";
      oppStatusEl.classList.remove('active-turn');
    } else {
      oppStatusEl.innerText = isAiMode ? "THINKING..." : "ENEMY MOVE...";
      oppStatusEl.classList.add('active-turn');
      playerStatusEl.innerText = "WAITING";
      playerStatusEl.classList.remove('active-turn');
    }
  }

  function checkGameStatus() {
    if (game.in_checkmate()) {
      isGameOver = true;
      stopHeartbeat();
      const winnerColor = game.turn() === 'w' ? 'b' : 'w';
      if (winnerColor === playerSide) {
        showModal('🏆', 'VICTORY!', 'Outstanding Commander! Checkmate, you conquered the war!');
      } else {
        showModal('💀', 'DEFEAT!', 'Checkmate! Enemy breached your lines.');
      }
    } else if (game.in_draw()) {
      isGameOver = true;
      stopHeartbeat();
      showModal('🤝', 'DRAW', 'Match concluded in an honorable draw.');
    }
  }

  function showModal(icon, title, message) {
    modalIcon.innerText = icon;
    modalTitle.innerText = title;
    modalMsg.innerText = message;
    gameModal.style.display = 'flex';
  }

  btnReviewBoard.addEventListener('click', () => {
    gameModal.style.display = 'none';
    playerStatusEl.innerText = isGameOver ? "GAME OVER" : "YOUR TURN";
    oppStatusEl.innerText = isGameOver ? "GAME OVER" : "WAITING";
  });

  btnModalAction.addEventListener('click', () => {
    gameModal.style.display = 'none';
    stopHeartbeat();
    if (conn) {
      try { conn.close(); } catch(e) {}
      conn = null;
    }
    screenArena.style.display = 'none';
    screenLobby.style.display = 'flex';
  });

  /* ---------------- P2P WEBRTC MULTIPLAYER & HEARTBEAT ---------------- */
  function startHeartbeat() {
    stopHeartbeat();
    lastOpponentPing = Date.now();
    heartbeatTimer = setInterval(() => {
      if (isGameOver) {
        stopHeartbeat();
        return;
      }

      if (conn && conn.open) {
        try {
          conn.send({ type: 'PING' });
        } catch (e) {
          handleOpponentDisconnected();
        }
      } else if (conn && !conn.open) {
        handleOpponentDisconnected();
      }

      // 4.5 விநாடிக்கு மேல் எந்த பதிலும் இல்லை எனில் துண்டிக்கப்பட்டதாக அறிவிக்கப்படும்
      if (Date.now() - lastOpponentPing > 4500) {
        handleOpponentDisconnected();
      }
    }, 2000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function handleOpponentDisconnected() {
    if (isGameOver) return;
    isGameOver = true;
    stopHeartbeat();

    playerStatusEl.innerText = "OPPONENT LEFT";
    playerStatusEl.classList.remove('active-turn');
    oppStatusEl.innerText = "DISCONNECTED";
    oppStatusEl.classList.remove('active-turn');

    showModal('🔌', 'OPPONENT ABANDONED', 'The enemy commander lost connection or fled the battlefield. Victory is yours!');
  }

  function setupPeerConnectionListeners() {
    conn.on('open', () => {
      const myName = document.getElementById('playerName').value.trim() || 'Commander';
      conn.send({ type: 'HANDSHAKE', name: myName });
      startHeartbeat();
    });

    // நேரடி WebRTC ICE Connection State கண்காணிப்பு
    if (conn.peerConnection) {
      conn.peerConnection.oniceconnectionstatechange = () => {
        const state = conn.peerConnection.iceConnectionState;
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          handleOpponentDisconnected();
        }
      };
    }

    conn.on('data', (data) => {
      // 1. Heartbeat Ping / Pong
      if (data.type === 'PING') {
        lastOpponentPing = Date.now();
        if (conn && conn.open) {
          try { conn.send({ type: 'PONG' }); } catch(e) {}
        }
        return;
      }
      if (data.type === 'PONG') {
        lastOpponentPing = Date.now();
        return;
      }

      // 2. எதிராளி வெளியேறினால்
      if (data.type === 'LEAVE_GAME') {
        handleOpponentDisconnected();
        return;
      }

      // 3. ஆட்ட நிகழ்வுகள்
      if (data.type === 'HANDSHAKE') {
        oppName.innerText = (data.name || 'OPPONENT').toUpperCase();
        startMultiplayerArena();
        startHeartbeat();
      } else if (data.type === 'MOVE') {
        const res = game.move(data.move);
        if (res) {
          lastMove = { from: res.from, to: res.to };
        }
        renderBoard();
        updateTurnStatus();
        updateCapturedPieces();
        checkGameStatus();
      } else if (data.type === 'RESIGN') {
        isGameOver = true;
        stopHeartbeat();
        showModal('🏆', 'VICTORY!', 'Enemy commander surrendered the war!');
      } else if (data.type === 'DRAW_OFFER') {
        if (confirm("Opponent is offering a draw. Do you accept?")) {
          isGameOver = true;
          stopHeartbeat();
          conn.send({ type: 'DRAW_ACCEPT' });
          showModal('🤝', 'DRAW', 'The war ended in an agreed draw.');
        } else {
          conn.send({ type: 'DRAW_DECLINE' });
        }
      } else if (data.type === 'DRAW_ACCEPT') {
        isGameOver = true;
        stopHeartbeat();
        showModal('🤝', 'DRAW', 'Opponent accepted the draw offer.');
      } else if (data.type === 'DRAW_DECLINE') {
        showModal('🛡️', 'DRAW DECLINED', 'Opponent declined your draw offer.');
        setTimeout(() => { gameModal.style.display = 'none'; }, 1600);
      }
    });

    conn.on('close', () => {
      handleOpponentDisconnected();
    });

    conn.on('error', () => {
      handleOpponentDisconnected();
    });
  }

  function startMultiplayerArena() {
    const pName = document.getElementById('playerName').value.trim() || 'Commander';
    playerNameDisplay.innerText = pName.toUpperCase();

    playerSide = isHost ? 'w' : 'b';

    if (playerSide === 'b') {
      commanderBadge.className = 'avatar-badge piece-b';
      commanderBadge.innerText = '♚';
      oppBadge.className = 'avatar-badge piece-w';
      oppBadge.innerText = '♔';
    } else {
      commanderBadge.className = 'avatar-badge piece-w';
      commanderBadge.innerText = '♔';
      oppBadge.className = 'avatar-badge piece-b';
      oppBadge.innerText = '♚';
    }

    game.reset();
    isGameOver = false;
    lastMove = null;
    selectedSquare = null;
    validMoves = [];

    renderBoard();
    updateTurnStatus();
    updateCapturedPieces();

    screenLobby.style.display = 'none';
    screenArena.style.display = 'flex';
  }

  // 1. Host Room Generation
  btnCreateRoom.addEventListener('click', () => {
    isHost = true;
    hostStatusMsg.innerText = "Connecting to signaling server...";
    btnCreateRoom.disabled = true;

    const generatedId = Math.floor(1000 + Math.random() * 9000);

    if (peer) peer.destroy();
    peer = new Peer(generatedId);

    peer.on('open', (id) => {
      roomCodeDisplay.style.display = 'flex';
      createdCodeText.innerText = id;
      hostStatusMsg.innerText = "Waiting for friend to join...";
    });

    peer.on('connection', (incomingConn) => {
      conn = incomingConn;
      setupPeerConnectionListeners();
    });

    peer.on('error', (err) => {
      hostStatusMsg.innerText = "Error creating room: " + err.type;
      btnCreateRoom.disabled = false;
    });
  });

  // Copy Code Button
  btnCopyCode.addEventListener('click', () => {
    const code = createdCodeText.innerText;
    navigator.clipboard.writeText(code).then(() => {
      btnCopyCode.innerText = "COPIED!";
      setTimeout(() => { btnCopyCode.innerText = "COPY"; }, 1500);
    });
  });

  // 2. Join Room (Guest)
  btnJoinRoom.addEventListener('click', () => {
    const targetRoom = joinRoomCodeInput.value.trim().toLowerCase();
    if (!targetRoom) {
      joinStatusMsg.innerText = "Please enter room code";
      return;
    }

    isHost = false;
    joinStatusMsg.innerText = "Connecting to Host...";
    btnJoinRoom.disabled = true;

    if (peer) peer.destroy();
    peer = new Peer();

    peer.on('open', () => {
      conn = peer.connect(targetRoom);
      setupPeerConnectionListeners();
    });

    peer.on('error', (err) => {
      joinStatusMsg.innerText = "Connection failed. Check code.";
      btnJoinRoom.disabled = false;
    });
  });

  /* ---------------- AI START GAME ---------------- */
  btnStartGame.addEventListener('click', () => {
    isAiMode = true;
    const pName = document.getElementById('playerName').value.trim() || 'Commander';
    playerNameDisplay.innerText = pName.toUpperCase();

    aiDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
    let chosenColor = document.querySelector('input[name="armyColor"]:checked').value;
    if (chosenColor === 'random') {
      chosenColor = Math.random() < 0.5 ? 'w' : 'b';
    }
    playerSide = chosenColor;

    if (playerSide === 'b') {
      commanderBadge.className = 'avatar-badge piece-b';
      commanderBadge.innerText = '♚';
      oppBadge.className = 'avatar-badge piece-w';
      oppBadge.innerText = '♔';
      oppName.innerText = `OPPONENT (${aiDifficulty.toUpperCase()})`;
    } else {
      commanderBadge.className = 'avatar-badge piece-w';
      commanderBadge.innerText = '♔';
      oppBadge.className = 'avatar-badge piece-b';
      oppBadge.innerText = '♚';
      oppName.innerText = `OPPONENT (${aiDifficulty.toUpperCase()})`;
    }

    game.reset();
    isGameOver = false;
    lastMove = null;
    selectedSquare = null;
    validMoves = [];

    renderBoard();
    updateTurnStatus();
    updateCapturedPieces();

    screenLobby.style.display = 'none';
    screenArena.style.display = 'flex';

    if (playerSide === 'b') {
      setTimeout(triggerAiMove, 500);
    }
  });

  // Action Buttons
  btnResign.addEventListener('click', () => {
    if (isGameOver) return;
    isGameOver = true;
    stopHeartbeat();
    if (!isAiMode && conn && conn.open) {
      try { conn.send({ type: 'RESIGN' }); } catch(e) {}
    }
    showModal('🏳️', 'SURRENDER', 'You surrendered the battle. Enemy wins.');
  });

  btnDraw.addEventListener('click', () => {
    if (isGameOver) return;
    if (isAiMode) {
      showModal('🛡️', 'DRAW REJECTED', 'Opponent evaluated the board and refused to surrender.');
      setTimeout(() => { gameModal.style.display = 'none'; }, 1800);
    } else if (conn && conn.open) {
      try { conn.send({ type: 'DRAW_OFFER' }); } catch(e) {}
      showModal('🤝', 'DRAW OFFERED', 'Draw offer sent to opponent commander...');
      setTimeout(() => { gameModal.style.display = 'none'; }, 1800);
    }
  });

  function notifyDisconnection() {
    if (!isAiMode && conn && conn.open) {
      try {
        conn.send({ type: 'LEAVE_GAME' });
      } catch (e) {}
    }
  }

  btnExitLobby.addEventListener('click', () => {
    isGameOver = true;
    stopHeartbeat();
    notifyDisconnection();
    if (conn) {
      try { conn.close(); } catch(e) {}
      conn = null;
    }
    screenArena.style.display = 'none';
    screenLobby.style.display = 'flex';
  });

  // மொபைல் பிரவுசர் டேப் மூடப்படும் போது அல்லது வெளியேறும் போது
  window.addEventListener('pagehide', notifyDisconnection);
  window.addEventListener('beforeunload', notifyDisconnection);
});
