const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/tasks
router.post('/', (req, res) => {
  const { projectId, parentId, name, mainTaskLevel } = req.body;

  if (!projectId || !name || !mainTaskLevel) {
    return res.status(400).json({ error: 'projectId, name, and mainTaskLevel are required' });
  }

  const validLevels = ['level1', 'level2', 'level3', 'level4'];
  if (!validLevels.includes(mainTaskLevel)) {
    return res.status(400).json({ error: 'Invalid mainTaskLevel' });
  }

  // Helper function to construct subtask hierarchy
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

  // Handle level1 separately (no parentId needed)
  if (mainTaskLevel === 'level1') {
    const insertSql = `
      INSERT INTO tasks (projectId, name, mainTaskLevel, level1)
      VALUES (?, ?, 'level1', NULL)
    `;
    db.query(insertSql, [projectId, name], (err, result) => {
      if (err) return res.status(500).json({ error: 'DB error', details: err });

      const newId = result.insertId;
      db.query(`UPDATE tasks SET level1 = ? WHERE id = ?`, [newId, newId], (updateErr) => {
        if (updateErr) return res.status(500).json({ error: 'Update error', details: updateErr });
        res.status(201).json({ message: 'Level 1 task created', taskId: newId });
      });
  });
  } else {
    // Fetch parent task
    db.query(`SELECT * FROM tasks WHERE id = ?`, [parentId], (err, results) => {
      if (err || results.length === 0) {
        return res.status(400).json({ error: 'Invalid parentId' });
      }

      const parent = results[0];

      // Prevent skipping levels (e.g., can't insert level3 before level2 exists)
      if (mainTaskLevel === 'level2' && !parent.level1) {
        return res.status(400).json({ error: 'Cannot insert level2 without level1 parent' });
      }
      if (mainTaskLevel === 'level3' && !parent.level2) {
        return res.status(400).json({ error: 'Cannot insert level3 without level2 parent' });
      }
      if (mainTaskLevel === 'level4' && !parent.level3) {
        return res.status(400).json({ error: 'Cannot insert level4 without level3 parent' });
      }

      const levels = buildLevelIds(parent, mainTaskLevel);

      const insertSql = `
        INSERT INTO tasks (projectId, name, mainTaskLevel, level1, level2, level3, level4)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(insertSql, [
        projectId,
        name,
        mainTaskLevel,
        levels.level1,
        levels.level2,
        levels.level3,
        levels.level4,
      ], (insertErr, result) => {
        if (insertErr) return res.status(500).json({ error: 'DB error', details: insertErr });
        res.status(201).json({ message: `${mainTaskLevel} task created`, taskId: result.insertId });
      });
    });
  }
});

module.exports = router;
