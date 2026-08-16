const { findUserById } = require('../models/userModel');
const { countCompletedSessions } = require('../models/sessionModel');
const { getFullRewardsCatalog } = require('../models/rewardModel');

async function getProfile(req, res) {
  try {
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalSessions = await countCompletedSessions(req.userId);

    res.status(200).json({
      name: user.name,
      email: user.email,
      streak: {
        current: user.current_streak,
        best: user.best_streak
      },
      totalSessions
    });
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
}

async function getRewards(req, res) {
  try {
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const rewards = await getFullRewardsCatalog(req.userId);
    res.status(200).json(rewards);
  } catch (err) {
    console.error('getRewards error:', err);
    res.status(500).json({ error: 'Server error fetching rewards' });
  }
}

module.exports = {
  getProfile,
  getRewards
};
