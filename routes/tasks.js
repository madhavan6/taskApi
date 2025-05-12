const express = require('express');
const router = express.Router();
const db = require('../db');

// Unified Task Insert Function
router.post('/', (req, res) => {
  const { projectId, parentId, name, level } = req.body;

  if (!projectId || !name || !level) {
    return res.status(400).json({ error: 'projectId, name, and level are required' });
  }

  const validLevels = ['level1', 'level2', 'level3', 'level4'];
  if (!validLevels.includes(level)) {
    return res.status(400).json({ error: 'Invalid level' });
  }

  // Helper function to build level hierarchy
  function buildLevelIds(parentTask, currentLevel) {
    const levels = {
      level1: null,
      level2: null,
      level3: null,
      level4: null,
    };

    if (currentLevel === 'level1') {
      return levels;
    }

    levels.level1 = parentTask.level1;
    levels.level2 = parentTask.level2;
    levels.level3 = parentTask.level3;

    if (currentLevel === 'level2') levels.level2 = parentTask.id;
    if (currentLevel === 'level3') levels.level3 = parentTask.id;
    if (currentLevel === 'level4') levels.level4 = parentTask.id;

    return levels;
  }

  // Check if the parent exists in the correct level
  function checkLevelAvailability(level, parentId, callback) {
    let query = '';
    
    if (level === 'level2') {
      query = `SELECT id FROM tasks WHERE id = ? AND level = 'level1'`;
    } else if (level === 'level3') {
      query = `SELECT id FROM tasks WHERE id = ? AND level = 'level2'`;
    } else if (level === 'level4') {
      query = `SELECT id FROM tasks WHERE id = ? AND level = 'level3'`;
    }

    if (query) {
      db.query(query, [parentId], (err, results) => {
        if (err || results.length === 0) {
          return callback(true); // Level not available
        }
        callback(false); // Level available
      });
    } else {
      callback(false); // Level 1 doesn't require a parent task, so it's always available
    }
  }

  // For level 1, directly insert the task
  if (level === 'level1') {
    const sql = `INSERT INTO tasks (projectId, name, level, level1) VALUES (?, ?, 'level1', NULL)`;
    db.query(sql, [projectId, name], (err, result) => {
      if (err) return res.status(500).json({ error: 'DB error', details: err });

      const newId = result.insertId;
      db.query(`UPDATE tasks SET level1 = ? WHERE id = ?`, [newId, newId], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Update error', details: updateErr });
        res.status(201).json({ message: 'Level 1 task created', taskId: newId });
      });
    });
  } else {
    // Check if parent task exists at the correct level
    checkLevelAvailability(level, parentId, (levelUnavailable) => {
      if (levelUnavailable) {
        return res.status(400).json({ error: `Parent task not available for level ${level}. You must insert tasks in sequence.` });
      }

      // Get parent task if available
      db.query(`SELECT * FROM tasks WHERE id = ?`, [parentId], (err, results) => {
        if (err || results.length === 0) {
          return res.status(400).json({ error: 'Invalid parentId' });
        }

        const parent = results[0];
        const levels = buildLevelIds(parent, level);

        // Check if the task already exists at the same level for the same project
        db.query(`SELECT * FROM tasks WHERE projectId = ? AND name = ? AND level = ?`, [projectId, name, level], (dupErr, dupResults) => {
          if (dupErr) return res.status(500).json({ error: 'DB error', details: dupErr });
          if (dupResults.length > 0) {
            return res.status(400).json({ error: 'Task with the same name already exists at this level' });
          }

          const insertSql = `
            INSERT INTO tasks (projectId, parentId, name, level, level1, level2, level3, level4)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          db.query(insertSql, [
            parent.projectId,
            parent.id,
            name,
            level,
            levels.level1,
            levels.level2,
            levels.level3,
            levels.level4,
          ], (insertErr, result) => {
            if (insertErr) return res.status(500).json({ error: 'DB error', details: insertErr });
            res.status(201).json({ message: `${level} task created`, taskId: result.insertId });
          });
        });
      });
    });
  }
});

module.exports = router;
