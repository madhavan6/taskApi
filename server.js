const express = require('express');
const app = express();
require('dotenv').config();

// Import routes
const tasksRoutes = require('./routes/tasks');

// ✅ Middleware to parse JSON
app.use(express.json());

// ✅ Root Route to show a welcome message
app.get('/', (req, res) => {
  res.send('Welcome to the Task Management API!');
});

// ✅ Mount the task routes
app.use('/api/tasks', tasksRoutes);

// ❌ Handle 404 - Not Found
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ❗ Global Error Handler (optional)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 🚀 Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
