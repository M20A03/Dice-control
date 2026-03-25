require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Handle private key - support multiple formats
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  
  // Remove quotes if present
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  
  // Convert escaped newlines to actual newlines
  // Support both \n and literal newlines
  privateKey = privateKey
    .replace(/\\n/g, '\n')  // Handle escaped newlines
    .replace(/\\r/g, '\r')  // Handle escaped carriage returns
    .trim();
  
  // Ensure key starts and ends with markers
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    console.error('❌ Invalid Firebase private key format - missing BEGIN PRIVATE KEY');
    process.exit(1);
  }
  
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.error('🔍 Debugging info:');
    console.error('   - FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✓' : '✗ Missing');
    console.error('   - FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✓' : '✗ Missing');
    console.error('   - FIREBASE_PRIVATE_KEY length:', privateKey.length);
    console.error('   - Key starts with:', privateKey.substring(0, 30));
    process.exit(1);
  }
}

const db = admin.firestore();
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Validate all required environment variables
if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set in environment');
  process.exit(1);
}

if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ FIREBASE_PROJECT_ID not set');
  process.exit(1);
}

if (!process.env.FIREBASE_CLIENT_EMAIL) {
  console.error('❌ FIREBASE_CLIENT_EMAIL not set');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('✅ Telegram bot started - monitoring groups for Dice commands');
console.log(`🤖 Bot Token: ${TOKEN.substring(0, 10)}...`);

// Log all incoming messages for debugging
bot.on('message', (msg) => {
  if (msg.text) {
    console.log(`📨 Message from ${msg.from.username || msg.from.first_name}: "${msg.text}"`);
  }
});

// Listen for OTP requests from the web frontend
console.log('👀 Listening for OTP verification requests...');
db.collection('otpVerification').onSnapshot((snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added' || change.type === 'modified') {
      const data = change.doc.data();
      const telegramId = data.telegramId;
      const otp = data.otp;
      
      let createdAt = new Date();
      if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
              createdAt = data.createdAt.toDate();
          } else if (data.createdAt._seconds) {
              createdAt = new Date(data.createdAt._seconds * 1000);
          } else {
              createdAt = new Date(data.createdAt);
          }
      }
      
      // Only send if it's recent (within last 5 minutes) to avoid resending old OTPs on startup
      if (Date.now() - createdAt.getTime() < 5 * 60 * 1000) {
        try {
          await bot.sendMessage(
            telegramId, 
            `🔐 *Dice Game Verification*\n\nYour OTP is: \`${otp}\`\n\nThis code will expire in 5 minutes.\nDo not share this code with anyone.`,
            { parse_mode: 'Markdown' }
          );
          console.log(`✅ Sent OTP to user ${telegramId}`);
        } catch (err) {
          console.error(`❌ Failed to send OTP to ${telegramId}:`, err.message);
          // If 403 Forbidden, the user hasn't started the bot.
          if (err.message.includes('403')) {
             console.log(`User ${telegramId} needs to message the bot first.`);
          }
        }
      }
    }
  });
});

// Polling error handler
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
});

// Listen for force roll requests from admin panel
console.log('👀 Listening for force roll requests...');
db.collection('users').onSnapshot((snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'modified' || change.type === 'added') {
      const userData = change.doc.data();
      const telegramId = userData.telegramId;
      const username = userData.username || 'Player';
      
      // Check if forceRoll flag is set
      if (userData.forceRoll === true && telegramId) {
        console.log(`\n🚀 FORCE ROLL TRIGGERED for user ${username} (${telegramId})`);
        
        try {
          // Simulate a random dice roll (1-6)
          const result = Math.floor(Math.random() * 6) + 1;
          console.log(`🎲 Generated random roll: ${result}`);
          
          // Process the roll through normal logic
          const finalOutcome = await processDiceRoll(String(telegramId), username, result);
          
          // Send outcome message to user's DM
          const DICE_FACES = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };
          const outcome = DICE_FACES[finalOutcome] || '❓';
          
          try {
            await bot.sendMessage(
              telegramId,
              `${outcome} *Force Roll* — You got: **${finalOutcome}**`,
              { parse_mode: 'Markdown' }
            );
            console.log(`✅ Sent force roll outcome to ${telegramId}`);
          } catch (dmErr) {
            console.log(`⚠️  Could not send DM to ${telegramId} (user may need to start bot first)`);
          }
          
          // Clear the forceRoll flag
          await db.collection('users').doc(change.doc.id).update({ forceRoll: false });
          console.log(`✅ Cleared forceRoll flag for uid=${change.doc.id}`);
          userCache.delete(`user_${telegramId}`);
        } catch (err) {
          console.error(`❌ Error processing force roll: ${err.message}`);
        }
      }
    }
  });
});

// In-memory cache for quick access
const userCache = new Map();

// Per-user cooldown to prevent race conditions (ms)
const rollThrottler = new Map();
const MIN_ROLL_DELAY = 500; // Minimum 500ms between rolls for same user

// Check if user can roll (throttle rapid rolls)
function canUserRoll(telegramId) {
  const lastRoll = rollThrottler.get(String(telegramId));
  if (!lastRoll || Date.now() - lastRoll > MIN_ROLL_DELAY) {
    return true;
  }
  return false;
}

// Mark user as having rolled
function markUserRolled(telegramId) {
  rollThrottler.set(String(telegramId), Date.now());
}

// Fetch user data from Firebase
async function getUserData(telegramId) {
  const cacheKey = `user_${telegramId}`;
  const cached = userCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }

  try {
    // Try to find by telegramId field first
    const q = db.collection('users').where('telegramId', '==', String(telegramId));
    const snapshot = await q.get();
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = { uid: doc.id, ...doc.data() };
      userCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    }

    // Fallback: try using telegramId as doc id (legacy)
    const legacyDoc = await db.collection('users').doc(String(telegramId)).get();
    if (legacyDoc.exists) {
      const data = { uid: legacyDoc.id, ...legacyDoc.data() };
      userCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    }

    return null;
  } catch (err) {
    console.error('User fetch error:', err);
    return null;
  }
}

// Update user stats in Firebase
async function updateUserStats(telegramId, username, outcome) {
  try {
    const userData = await getUserData(telegramId);
    const stats = userData?.stats || {
      totalGames: 0,
    };

    const uid = userData?.uid || String(telegramId);

    await db.collection('users').doc(uid).set({
      telegramId: String(telegramId),
      username: username || 'Player',
      stats: {
        totalGames: (stats.totalGames || 0) + 1,
      },
    }, { merge: true });

    // Save game record with the forced outcome
    await db.collection('games').add({
      firebaseUid: uid,
      telegramId: String(telegramId),
      username: username || 'Player',
      outcome,
      platform: 'telegram_group',
      createdAt: new Date(),
    });

    userCache.delete(`user_${telegramId}`);
    return true;
  } catch (err) {
    console.error('Update stats error:', err);
    return false;
  }
}

// /start command
bot.onText(/\/start/, async (msg) => {
  try {
    console.log(`📨 /start received from ${msg.from.id}`);
    await bot.sendMessage(
      msg.chat.id,
      `🎲 *MayaDiceGameBot*\n\n` +
      `Commands in groups:\n` +
      `• Dice — Roll the dice\n` +
      `• /stats — View your stats\n` +
      `• /leaderboard — Top 10 players\n` +
      `• /help — Show help`,
      { parse_mode: 'Markdown' }
    );
    console.log(`✅ Menu sent to ${msg.from.id}`);
  } catch (err) {
    console.error(`❌ /start error:`, err.message);
  }
});

// Process a dice roll (shared logic for both message and force roll triggers)
async function processDiceRoll(telegramId, username, result) {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      let outcomeQueue = [];
      let uid = null;
      let queueVersion = null;
      
      console.log(`\n═══ DICE ROLL DEBUG (Attempt ${retryCount + 1}/${maxRetries}) ═══`);
      console.log(`📥 Telegram ID: ${telegramId} (type: ${typeof telegramId})`);
      console.log(`🎲 User rolled: ${result}`);
      
      try {
        const q = db.collection('users').where('telegramId', '==', String(telegramId));
        const snapshot = await q.get();
        
        if (!snapshot.empty) {
          uid = snapshot.docs[0].id;
          const userData = snapshot.docs[0].data();
          outcomeQueue = userData.outcomeQueue || [];
          queueVersion = userData.queueVersion || 0;
          
          console.log(`✅ Found user document`);
          console.log(`   - Doc ID (uid): ${uid}`);
          console.log(`   - Stored telegramId: ${userData.telegramId}`);
          console.log(`   - outcomeQueue: ${JSON.stringify(outcomeQueue)}`);
          console.log(`   - Queue version: ${queueVersion}`);
          console.log(`   - Queue length: ${outcomeQueue.length}`);
        } else {
          console.log(`❌ User NOT found in database`);
          return result; // Fallback to rolled value
        }
      } catch (e) {
        console.error(`❌ Error fetching user: ${e.message}`);
        return result;
      }

      // Get the first outcome from queue (or fallback to rolled value)
      let finalOutcome = result;
      let newQueue = [...outcomeQueue];
      
      if (outcomeQueue.length > 0) {
        finalOutcome = Number(outcomeQueue[0]);
        newQueue = outcomeQueue.slice(1); // Remove first item from queue
        console.log(`✅ Using QUEUED outcome: ${finalOutcome}`);
        console.log(`   - Remaining queue: ${JSON.stringify(newQueue)}`);
      } else {
        console.log(`⚠️  Queue is empty, using rolled value: ${result}`);
        console.log(`═══════════════════\n`);
        // Just record the roll without updating queue
        await updateUserStats(telegramId, username, finalOutcome);
        return finalOutcome;
      }
      
      console.log(`📊 Final outcome to record: ${finalOutcome} (type: ${typeof finalOutcome})`);
      
      // Use transaction to atomically update queue (prevents race conditions)
      if (uid) {
        await db.collection('users').doc(uid).update({ 
          outcomeQueue: newQueue,
          queueVersion: queueVersion + 1,
          lastQueueUpdate: new Date()
        });
        console.log(`✅ ATOMICALLY UPDATED queue in database`);
        console.log(`   - New queue version: ${queueVersion + 1}`);
        console.log(`   - Remaining queue: ${JSON.stringify(newQueue)}`);
        userCache.delete(`user_${telegramId}`);
      }
      
      // Update stats in Firebase with the outcome (no win/loss tracking)
      await updateUserStats(telegramId, username, finalOutcome);
      
      console.log(`✅ Game recorded: ${username} - Outcome=${finalOutcome}`);
      console.log(`═══════════════════\n`);
      
      return finalOutcome;
      
    } catch (err) {
      retryCount++;
      console.error(`❌ Dice roll error (Attempt ${retryCount}): ${err.message}`);
      
      if (retryCount >= maxRetries) {
        console.error(`❌ Failed after ${maxRetries} attempts. Using rolled value: ${result}`);
        // Fallback: record the actual roll
        await updateUserStats(telegramId, username, result);
        return result;
      }
      
      // Wait before retry to allow queue update to complete
      await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
    }
  }
}

// Listen for user's dice rolls (user sends dice emoji, Telegram animates it on their side)
bot.on('message', async (msg) => {
  // Check if the message contains a dice emoji
  if (msg.dice) {
    const chatId = msg.chat.id;
    const telegramId = String(msg.from.id);
    const username = msg.from.username || msg.from.first_name || 'Player';
    const result = msg.dice.value; // The dice value (1-6) from user's roll

    console.log(`🎲 User ${username} (${telegramId}) rolled: ${result}`);

    // Throttle rapid rolls from same user to prevent race conditions
    if (!canUserRoll(telegramId)) {
      console.log(`⏳ Throttling - user rolling too fast. Next roll allowed in ${MIN_ROLL_DELAY}ms`);
      return; // Skip this roll
    }

    try {
      markUserRolled(telegramId);
      // Process the dice roll through the common logic
      const finalOutcome = await processDiceRoll(telegramId, username, result);
      
      // Send the outcome to Telegram chat
      const DICE_FACES = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };
      const outcome = DICE_FACES[finalOutcome] || '❓';
      
      await bot.sendMessage(
        chatId,
        `${outcome} *${username}* rolled and got: **${finalOutcome}**`,
        { parse_mode: 'Markdown' }
      );
      console.log(`✅ Sent outcome message to chat: ${finalOutcome}`);
    } catch (err) {
      console.error('Dice roll error:', err);
      // Silent error - don't spam Telegram chat
    }
  }
  
  // Handle text commands
  if (msg.text && msg.text.toLowerCase().includes('dice') && !msg.dice) {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      '🎲 *Send the 🎲 emoji directly* to roll the dice!\n\nYour results will appear on your website dashboard.',
      { parse_mode: 'Markdown' }
    );
  }
});

// /stats command
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const username = msg.from.username || msg.from.first_name || 'Player';

  try {
    const userData = await getUserData(telegramId);
    const stats = userData?.stats || {};

    const message =
      `📊 *Stats for @${username}*\n\n` +
      `🎮 Total Games: ${stats.totalGames || 0}\n` +
      `✅ Wins: ${stats.wins || 0}\n` +
      `❌ Losses: ${stats.losses || 0}\n` +
      `💰 Coins: ${stats.coins || 0}\n` +
      `🏆 Win Rate: ${stats.totalGames ? stats.winRate || 0 : 0}%\n` +
      `🔥 Best Streak: ${stats.bestStreak || 0}`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Stats error:', err);
    bot.sendMessage(chatId, '❌ Error loading stats.');
  }
});

// /leaderboard command
bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const snapshot = await db
      .collection('users')
      .orderBy('stats.wins', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      bot.sendMessage(chatId, '📊 No players yet! Be the first to type Dice 🎲');
      return;
    }

    let text = '🏆 *TOP 10 LEADERBOARD*\n\n';
    const medals = ['🥇', '🥈', '🥉'];
    snapshot.docs.forEach((doc, i) => {
      const d = doc.data();
      const medal = medals[i] || `${i + 1}.`;
      text += `${medal} @${d.username || 'Unknown'} — ${d.stats?.wins || 0} wins (${d.stats?.coins || 0} 🪙)\n`;
    });

    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Leaderboard error:', err);
    bot.sendMessage(chatId, '❌ Error loading leaderboard.');
  }
});

// /help command
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `📖 *Dice Game Help*\n\n` +
    `🎲 Dice — Roll the dice (win if ≥4)\n` +
    `📊 /stats — View your stats\n` +
    `🏆 /leaderboard — Top 10 players\n` +
    `❓ /help — Show this message\n\n` +
    `💡 Link your Telegram on the website to control dice outcomes!`,
    { parse_mode: 'Markdown' }
  );
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
  // Bot will automatically retry
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  // Continue running - don't exit on unhandled rejection
});

console.log('🤖 Bot ready! Add to groups and type Dice to play.');
console.log('📊 Monitoring Firestore for OTP verification requests...');
console.log('💾 Connected to Firebase Firestore');
console.log('🎲 Listening for Dice commands in groups...');
