const functions = require('firebase-functions');
const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');
const express = require('express');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Get TOKEN from Firebase config or environment variable
let TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  try {
    TOKEN = functions.config()?.telegram?.bot_token || process.env.TELEGRAM_BOT_TOKEN;
  } catch (e) {
    console.warn('Firebase config not available, will use process.env');
    TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  }
}

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set in Firebase config or environment');
  console.error('Set it with: firebase functions:config:set telegram.bot_token="YOUR_TOKEN"');
}

// Create bot in webhook mode (no polling)
const bot = new TelegramBot(TOKEN);

// Express app for webhook
const app = express();
app.use(express.json());

// Webhook endpoint for Telegram updates
app.post('/webhook', async (req, res) => {
  try {
    await bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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

// Dice command - MAIN DICE GAME
bot.onText(/Dice|🎲/i, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const username = msg.from.username || msg.from.first_name || 'Player';

  try {
    // Always fetch fresh forced outcome from Firebase (bypass cache)
    let forcedOutcome = null;
    let uid = null;
    
    try {
      const q = db.collection('users').where('telegramId', '==', String(telegramId));
      const snapshot = await q.get();
      if (!snapshot.empty) {
        uid = snapshot.docs[0].id;
        forcedOutcome = snapshot.docs[0].data().forcedOutcome;
      }
    } catch (e) {
      console.log(`Could not find user by telegramId: ${telegramId}`);
    }

    let result;
    let isWin;

    // Check for admin-set forced outcome
    if (forcedOutcome && Number(forcedOutcome) >= 1 && Number(forcedOutcome) <= 6) {
      result = Number(forcedOutcome);
      
      // MAGIC TRICK: Roll the real animated dice until it hits the forced number!
      let matchFound = false;
      for (let i = 0; i < 20; i++) {
        const diceMsg = await bot.sendDice(chatId);
        if (diceMsg.dice.value === result) {
          matchFound = true;
          break;
        }
        // If it's the wrong number, delete it instantly
        await bot.deleteMessage(chatId, diceMsg.message_id).catch(() => {});
        await new Promise(res => setTimeout(res, 200));
      }

      if (!matchFound) {
        bot.sendMessage(chatId, `🎲 (Server forced roll delayed)`);
      }

      // Clear forced outcome after use
      if (uid) {
        await db.collection('users').doc(uid).update({ forcedOutcome: null });
        userCache.delete(`user_${telegramId}`);
        console.log(`✅ Used forced outcome ${result} for ${username} (${telegramId})`);
      }
    } else {
      // NORMAL ROLL: Send 1 real animated dice
      const diceMsg = await bot.sendDice(chatId);
      result = diceMsg.dice.value;
    }

    isWin = result >= 4;

    // Update stats
    await updateUserStats(telegramId, username, result, isWin);

  } catch (err) {
    console.error('Roll error:', err);
    bot.sendMessage(chatId, '❌ Error rolling dice. Make sure the bot is an admin in the group.');
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

// Listen for OTP requests (Firestore listener runs continuously)
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
      
      // Only send if it's recent (within last 5 minutes)
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
          if (err.message.includes('403')) {
             console.log(`User ${telegramId} needs to message the bot first.`);
          }
        }
      }
    }
  });
});

// Export Cloud Function
exports.telegramBot = functions.https.onRequest(app);
