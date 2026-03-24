# Deploy Dice Bot to Railway

## Step-by-Step Instructions

### 1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Sign in with your GitHub account

### 2. **Create New Project**
   - Click **"+ New Project"** button
   - Click **"Deploy from GitHub"**
   - Find and select the **Dice** repository
   - Click **"Deploy Now"**

### 3. **Set Environment Variables**
   Once the project is created:
   - Click on your project
   - Go to **"Variables"** tab
   - Add these variables:

   ```
   TELEGRAM_BOT_TOKEN=8706599549:AAF_vovHaOhkby_nACym_hj23BluaF6cWV8
   FIREBASE_PROJECT_ID=dice-roller-choice
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@dice-roller-choice.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCxW4CH9H82DdRi\nqajPhOThfOO5VC5ANGdVN6NR5k2rmJPwVDpKwp3i+dImq4ht6mxWcYXmBI94xkNR\nHprEX9Y9P98hd6NhOJ0K8REli5GYc5zkX3v9qUzuVsm//aYr34SaTXx2dScoDVSk\nNPuqQsMfjOCPQR7wWZoNZgSYPqpirU+Cz/NPn8ZcEM8OFWOHGRzBN02d1FjhmK72\n8M1P5BgbGzXJ/Fe9HesASbu2mVhCkByjOVTwum3KGYRkRULusab3JWxp7HA7zSg3\n18K/o4IHlkI0XOKLg73PibDO+pXyB8VPZBLiQ6DM/+tpnStCeV53WVujdIeCpAX8\n1Y25Dx39AgMBAAECggEACunbQyJtqIUZ1ldjyp8+GUz+01LlhLBk0mbZzyqZiW9a\nXR3Ft395yTN/tb705nSYJYqXR3Ps4yzqDAYS1nYiQAMb5xqOTGd4LGnwmOuZcjTd\nCOWCQvXlxL3E7OI+FTGMHpWZjM2BMxL87BzRhqTUjm60C8ShU39j/iKSsk6a2/b9\nbpEecT6LL62KFYfHd542XpcOuEMkXEdRU1iMafJSRW3byfN1L23Y1m3Djxj9ZvXT\no3q0HbDnf9cYcbZMvWZfv6WnWi2uhLQuw0iZbjVisBm6LiEJzlP1EKBA+zQY0SIn\n7dV4ugVtwOTfOtu3v+ZtoxBN8rVajHCPXYhcvSrWAQKBgQDfV0uSHLO38chjkR9g\nST5kNyZWiGyVGKxhpz8c78alumEuMs6UKFF/gFtQkajw/aZKCXPp8nVCTfjahPBm\nfuLLcVvgjWlyp1ABeZLowSIl8RV9skiRhgWsuNGRiWnunbMxi+i1kNOoRNSPKEXM\nQuEV2aT+cnH0Cgmyyw+0KPIOAQKBgQDLStNVKYckmnM4fkFQ9r6+I1wfOv6R+Uig\nnmbYWjppZTWs46w1P/SBs0fInKTUhZng/cM4yXwt5cCx8lQOBJ1JLvPXEHvmZrDj\nzjIEHBEqOZzrTb3simtUvM+aYOd6OlpRdYjRiPkF6+++mnBsTlCgwkXcKsEEMYOQ\nVf1gufVH/QKBgQDD0pCKHexd3frrgfTWwaGY0NomiRtbZvTN8oxd3MZ5zP8kOJv0\nP52lg2+NJwnPsza4N62QdGvnpOILBwCZfatw4YXDT3ojcxutD2GF/sDoL4e+XDFQ\nlwgmty3Yw3lEJLVXPereN4u9QAx3MMJyJDmipOAL0WCkrqBuSakNN9F0AQKBgFZ1\n53XD6L9PlQuE3wCxQKSbY1XBAH5S+GmflPwVO9yReAek+RvYrIPxHOmcfZoJjE2d\nf8cKIm9e1NqZxtgDbGWwu3JPh3KRYFAy5SDMUxyTTkLhWJJeuJFckCsHZcudP8Z/\nZ4Y+bDLxipCVHJVjpXUJyy59XIQNDvh3KgFWdZR9AoGAGfkMo0/VAZag2cyp+KjT\nQugqElHq3tfMDPxAjMnmJm/uQlusy88h6oJ6uN5jGSyMXN5C9ZFXQ80cCRi5LDjm\nrOHZ0ZCmQfPnzJ3UB/3YIQMFVLS9Ykl0GTAeUDhzhaJUyuDnfQbZj3fpKuXauLDn\nYzNijF8c3JKr7m0whmZTeYE=\n-----END PRIVATE KEY-----\n
   ```

### 4. **Configure the Start Command**
   In Railway:
   - Go to **"Settings"** tab
   - Look for **"Start Command"**
   - Set it to: `node telegram-bot/bot.js`

### 5. **Deploy**
   - Click **"Deploy"** button
   - Wait for it to complete (watch the logs)
   - You should see: ✅ Telegram bot started

### 6. **Verify It's Running**
   - You should see logs like: `✅ Telegram bot started - monitoring groups for Dice commands`
   - Your bot will now run **24/7 for FREE** on Railway!

---

## Cost
- **FREE** - Railway gives you $5/month free credits
- Your bot uses ~$0.50-$1/month max
- No payment required!

## What Happens Now
- ✅ Bot runs 24/7 in the cloud
- ✅ Responds to "Dice" and 🎲 in Telegram groups
- ✅ Frontend on Firebase (free)
- ✅ Both working together

---

## Troubleshooting
If the bot doesn't start:
1. Check the logs in Railway dashboard
2. Verify all environment variables are set correctly
3. Make sure TELEGRAM_BOT_TOKEN is correct

Need help? Let me know!
