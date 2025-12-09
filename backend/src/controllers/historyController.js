const History = require('../models/History');

class HistoryController {
  static async getRecentHistory(req, res) {
    try {
      const { limit = 100 } = req.query;
      const history = await History.getRecentHistory(parseInt(limit));

      res.json({
        history,
        count: history.length
      });
    } catch (error) {
      console.error('Erreur getRecentHistory:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async getOrderHistory(req, res) {
    try {
      const { orderId } = req.params;
      const history = await History.getByOrderId(orderId);

      res.json({
        history,
        count: history.length
      });
    } catch (error) {
      console.error('Erreur getOrderHistory:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async getUserHistory(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 50 } = req.query;

      const history = await History.getByUserId(userId, parseInt(limit));

      res.json({
        history,
        count: history.length
      });
    } catch (error) {
      console.error('Erreur getUserHistory:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async getStatistics(req, res) {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId) : (req.user.role === 'preparateur' ? req.user.id : null);
      const { startDate, endDate } = req.query;

      const stats = await History.getStatistics(userId, startDate, endDate);

      res.json({
        statistics: stats,
        filters: {
          userId,
          startDate,
          endDate
        }
      });
    } catch (error) {
      console.error('Erreur getStatistics:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }

  static async getUserPerformance(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const performance = await History.getUserPerformance(startDate, endDate);

      res.json({
        performance,
        count: performance.length
      });
    } catch (error) {
      console.error('Erreur getUserPerformance:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  }
}

module.exports = HistoryController;
