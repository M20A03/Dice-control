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

// In-memory cache for quick access
const userCache = new Map();

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
async function updateUserStats(telegramId, username, result, isWin) {
  try {
    const userData = await getUserData(telegramId);
    const stats = userData?.stats || {
      totalGames: 0,
      wins: 0,
      losses: 0,
      coins: 0,
      currentStreak: 0,
      bestStreak: 0,
      winRate: 0,
    };

    const uid = userData?.uid || String(telegramId);
    const newWins = stats.wins + (isWin ? 1 : 0);
    const newLosses = stats.losses + (isWin ? 0 : 1);
    const newStreak = isWin ? (stats.currentStreak || 0) + 1 : 0;
    const newBestStreak = Math.max(stats.bestStreak || 0, newStreak);
    const coinsEarned = isWin ? 10 : 0;

    await db.collection('users').doc(uid).set({
      telegramId: String(telegramId),
      username: username || 'Player',
      stats: {
        totalGames: (stats.totalGames || 0) + 1,
        wins: newWins,
        losses: newLosses,
        coins: (stats.coins || 0) + coinsEarned,
        currentStreak: newStreak,
        bestStreak: newBestStreak,
        winRate: Math.round((newWins / ((stats.totalGames || 0) + 1)) * 100),
      },
    }, { merge: true });

    // Save game record
    await db.collection('games').add({
      firebaseUid: uid,
      telegramId: String(telegramId),
      username: username || 'Player',
      result,
      isWin,
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

// MAIN HANDLER: Listen for actual dice emoji rolls
bot.on('message', async (msg) => {
  if (!msg.dice) return; // Only handle dice rolls
  
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const username = msg.from.username || msg.from.first_name || 'Player';
  const result = msg.dice.value; // Telegram's actual roll (1-6)
  
  console.log(`\n🎲 DICE ROLL from ${username} (${telegramId}): actual=${result}`);
  
  try {
    // Check if user has a controlled outcome set
    let nextOutcome = null;
    let uid = null;
    
    // Try to find user by telegramId field
    const q = db.collection('users').where('telegramId', '==', String(telegramId));
    const snapshot = await q.get();
    
    if (!snapshot.empty) {
      uid = snapshot.docs[0].id;
      nextOutcome = snapshot.docs[0].data().nextOutcome || null;
      console.log(`✅ Found user. nextOutcome=${nextOutcome}`);
    } else {
      // Fallback: try by doc ID
      const docRef = await db.collection('users').doc(String(telegramId)).get();
      if (docRef.exists) {
        uid = String(telegramId);
        nextOutcome = docRef.data().nextOutcome || null;
        console.log(`✅ Found user by ID. nextOutcome=${nextOutcome}`);
      }
    }
    
    // Determine final outcome
    let finalOutcome = result; // Default: use actual roll
    if (nextOutcome && nextOutcome > 0 && nextOutcome <= 6) {
      finalOutcome = Number(nextOutcome);
      console.log(`✅ USING CONTROLLED OUTCOME: ${finalOutcome}`);
      
      // Clear outcome after use
      if (uid) {
        await db.collection('users').doc(uid).update({ 
          nextOutcome: null,
          lastOutcome: finalOutcome,
          lastRollTime: new Date()
        });
        console.log(`✅ Cleared nextOutcome`);
      }
    } else {
      console.log(`⚠️ No controlled outcome. Using actual roll: ${result}`);
    }
    
    // Record game
    await db.collection('games').add({
      telegramId: String(telegramId),
      username: username,
      outcome: finalOutcome,
      actualRoll: result,
      createdAt: new Date(),
      controlled: nextOutcome !== null ? true : false
    });
    
    // Send reply showing the outcome
    const emoji = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][finalOutcome - 1];
    await bot.sendMessage(
      chatId,
      `✅ Outcome: ${emoji} *${finalOutcome}*${nextOutcome ? ' (controlled)' : ''}`,
      { parse_mode: 'Markdown' }
    );
    
    console.log(`✅ Recorded: final=${finalOutcome}, controlled=${nextOutcome !== null}\n`);
    
  } catch (err) {
    console.error(`❌ Dice roll error: ${err.message}`);
    bot.sendMessage(chatId, `❌ Error: ${err.message}`).catch(() => {});
  }
});

// /debug command
bot.onText(/\/debug/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  
  try {
    const q = db.collection('users').where('telegramId', '==', String(telegramId));
    const snapshot = await q.get();
    
    if (!snapshot.empty) {
      const userData = snapshot.docs[0].data();
      const nextOutcome = userData.nextOutcome || 'not set';
      await bot.sendMessage(
        chatId,
        `🔍 Debug Info:\n` +
        `ID: ${snapshot.docs[0].id}\n` +
        `Next Outcome: ${nextOutcome}`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await bot.sendMessage(chatId, '❌ User not found in database');
    }
  } catch (err) {
    console.error(`Debug error: ${err.message}`);
    bot.sendMessage(chatId, `❌ Debug error: ${err.message}`).catch(() => {});
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
