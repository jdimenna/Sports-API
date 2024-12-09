import express from 'express';
import { connectDB } from '../Config/db.js';
const router = express.Router();

router.get('/total-players', async (req, res) => {
    try {
        const db = await connectDB();
        const result = await db.collection('players').aggregate([
            { $count: "totalPlayers" }
        ]).toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error counting players", error });
    }
});

router.get('/average-age', async (req, res) => {
    try {
        const db = await connectDB();
        const result = await db.collection('players').aggregate([
            { 
                $group: { 
                    _id: "$team", 
                    averageAge: { $avg: "$age" } // Use $avg for calculating averages
                } 
            }
        ]).toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error calculating average age", error });
    }
    
});

router.get('/players-with-team', async (req, res) => {
    try {
        const db = await connectDB();
        const result = await db.collection('players').aggregate([
            { $project: {_id: 0, name: 1, team: 1, position: 1} }
        ]).toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving players", error });
    }
});

router.get('/oldest-players', async (req, res) => {
    try {
        const db = await connectDB();
        const result = await db.collection('players').aggregate([
            { $sort: { age: -1} },
            { $limit: 5 }
        ]).toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error finding oldest players", error });
    }
});

router.get('/total-matches', async (req, res) => {
    try {
        const db = await connectDB();
        const result = await db.collection('matches').aggregate([
            { $facet: {
                homeGames: [
                    { $group: {_id: "$home_team", totalHomeGames: { $sum: 1 }}}
                ],
                awayGames: [
                    { $group: {_id: "$away_team", totalAwayGames: { $sum: 1 }}}
                ],
            } }
        ]).toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error counting matches", error });
    }
});

router.get('/wins-per-team', async (req, res) => {
    try {
      const db = await connectDB();
   
      // Aggregate to count wins for each team (home and away)
      const result = await db.collection('matches').aggregate([
        {
          $lookup: {
            from: 'scores',          // Join with the 'scores' collection
            localField: '_id',       // Match _id in the 'matches' collection
            foreignField: 'match_id', // Match 'match_id' in the 'scores' collection
            as: 'match_scores'       // Output the result in a field called 'match_scores'
          }
        },
        { $unwind: '$match_scores' }, // Unwind the 'match_scores' array
   
        // Separate home wins and away wins
        {
          $facet: {
            homeWins: [
              {
                $match: {
                  $expr: {
                    $gt: ['$match_scores.home_score', '$match_scores.away_score'] // Home team wins if home_score > away_score
                  }
                }
              },
              { $group: { _id: '$home_team', wins: { $sum: 1 } } } // Count wins for home team
            ],
            awayWins: [
              {
                $match: {
                  $expr: {
                    $gt: ['$match_scores.away_score', '$match_scores.home_score'] // Away team wins if away_score > home_score
                  }
                }
              },
              { $group: { _id: '$away_team', wins: { $sum: 1 } } } // Count wins for away team
            ]
          }
        },
   
        // Combine home and away wins into one list
        {
          $project: {
            totalWins: { $concatArrays: ['$homeWins', '$awayWins'] }
          }
        },
   
        // Unwind the 'totalWins' array to merge home and away wins
        { $unwind: '$totalWins' },
   
        // Group by team and sum the wins for each team (from both home and away games)
        {
          $group: {
            _id: '$totalWins._id',  // Team name
            wins: { $sum: '$totalWins.wins' } // Total wins for each team
          }
        },
   
        // Optionally, sort by the number of wins in descending order
        { $sort: { wins: -1 } }
      ]).toArray();
   
      // Send the result back to the client
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Error counting wins', error });
    }
  });

router.get('/total-score-by-team', async (req, res) => { // not working
    try {
        const db = await connectDB();
        const result = await db.collection('matches').aggregate([
            { $group: {
                _id: "$home_team",
                totalHomeScore: { $sum: "$home_score" },
                totalAwayScore: { $sum: "$away_score" }
            } }
        ]).toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error calculating total score", error });
    }
});

router.get('/players-more-than-10-matches', async (req, res) => {
    try {
        const db = await connectDB();
        const result = await db.collection('matches').aggregate([
            { $lookup: {
                from: "players",
                localField: "home_team",
                foreignField: "team",
                as: "homePlayers"
            } },
            { $unwind: "$homePlayers" },
            { $group: { _id: "$homePlayers.name", matchCount: { $sum: 1 }}},
            { $match: { matchCount: { $gt: 10}}}
        ]).toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving players", error });
    }
});

router.get('/most-scored-player', async (req, res) => { //not working
    try {
        const db = await connectDB();
        const result = await db.collection('matches').aggregate([
            { $lookup: {
                from: "players",
                localField: "home_team",
                foreignField: "team",
                as: "homePlayers"
            } },
            { $unwind: "$homePlayers" },
            { $group: {
                _id: "$homePlayers.name",
                totalGoals: { $sum: "$home_score" }
            }},
            { $sort: { totalGoals: -1}},
            { $limit: 1 }
        ]).toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error finding top scorer", error });
    }
});

router.get('/teams-more-than-10-matches', async (req, res) => { //not working
    try {
        const db = await connectDB();
        const result = await db.collection('matches').aggregate([
            { $group: {
                _id: { $concat: ["$home_team", "-", "$away_team"]},
                matchCount: { $sum: 1 }
            } },
            { $match: { matchCount: { $gt: 10 }}}
        ]).toArray();
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error counting teams' matches", error });
    }
});

export default router;
