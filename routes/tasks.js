const express = require('express');
const router = express.Router();
const db = require('../db');
// Helper function to convert ISO datetime string to MySQL DATETIME format
function convertToMySQLDateTime(isoDateStr) {
  if (!isoDateStr) return null;
  return isoDateStr.replace('T', ' ').replace('Z', '');
}

// Helper function to convert ISO datetime string to MySQL DATETIME format
function convertToMySQLDateTime(isoDateStr) {
  if (!isoDateStr) return null;
  return isoDateStr.replace('T', ' ').replace('Z', '');
}
// POST /api/tasks
router.post('/', (req, res) => {
  const task = req.body;

  if (!task || !task.id || !task.userID) {
    return res.status(400).json({ error: 'task.id and task.userID are required' });
  }
// GET /api/tasks
router.get('/', (req, res) => {
  const sql = 'SELECT * FROM tasks ORDER BY id';
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error', details: err });
    }
    res.json(results);
  });
});

  // Check if task already exists for that user
  const checkSql = 'SELECT id FROM tasks WHERE id = ? AND userID = ?';
  db.query(checkSql, [task.id, task.userID], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error', details: err });

    if (rows.length > 0) {
      return res.status(409).json({ message: 'Task already exists for this user. Skipped.' });
    }

    const insertSql = `
      INSERT INTO tasks (
        id, wsID, userID, projectID, name, description, taskLevel, status,
        parentID, level1ID, level2ID, level3ID, level4ID,
        assignee1ID, assignee2ID, assignee3ID,
        estHours, estPrevHours, actHours, isExceeded,
        priority, info, createdAt, modifiedAt, dueDate,
        comments, expanded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(insertSql, [
      task.id, task.wsID, task.userID, task.projectID, task.name, task.description, task.taskLevel, task.status,
      task.parentID, task.level1ID, task.level2ID, task.level3ID, task.level4ID,
      task.assignee1ID, task.assignee2ID, task.assignee3ID,
      task.estHours, task.estPrevHours, task.actHours, task.isExceeded,
      task.priority, JSON.stringify(task.info),
      convertToMySQLDateTime(task.createdAt),
      convertToMySQLDateTime(task.modifiedAt),
      convertToMySQLDateTime(task.dueDate),
      task.comments, task.expanded
    ], (insertErr) => {
      if (insertErr) return res.status(500).json({ error: 'Insert error', details: insertErr });
      res.status(201).json({ message: 'Task inserted successfully' });
    });
  });
});

router.post('/import', async (req, res) => {
  const tasks = Array.isArray(req.body) ? req.body : [req.body];

  try {
    const insertPromises = tasks.map(async (task) => {
      return new Promise((resolve, reject) => {
        // Check if task with same ID and userID already exists
        const checkSql = 'SELECT id FROM tasks WHERE id = ? AND userID = ?';
        db.query(checkSql, [task.id, task.userID], (err, rows) => {
          if (err) return reject(err);

          if (rows.length === 0) {
            const insertSql = `
              INSERT INTO tasks (
                id, wsID, userID, projectID, name, description, taskLevel, status,
                parentID, level1ID, level2ID, level3ID, level4ID,
                assignee1ID, assignee2ID, assignee3ID,
                estHours, estPrevHours, actHours, isExceeded,
                priority, info, createdAt, modifiedAt, dueDate,
                comments, expanded
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(insertSql, [
              task.id, task.wsID, task.userID, task.projectID, task.name, task.description, task.taskLevel, task.status,
              task.parentID, task.level1ID, task.level2ID, task.level3ID, task.level4ID,
              task.assignee1ID, task.assignee2ID, task.assignee3ID,
              task.estHours, task.estPrevHours, task.actHours, task.isExceeded,
              task.priority, JSON.stringify(task.info),
              convertToMySQLDateTime(task.createdAt),
              convertToMySQLDateTime(task.modifiedAt),
              convertToMySQLDateTime(task.dueDate),
              task.comments, task.expanded
            ], (insertErr) => {
              if (insertErr) return reject(insertErr);
              resolve('inserted');
            });
          } else {
            resolve('duplicate'); // Skip duplicates
          }
        });
      });
    });

    await Promise.all(insertPromises);
    res.status(200).json({ message: 'Tasks imported successfully, duplicates ignored.' });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Failed to import tasks', details: err });
  }
});

module.exports = router;
