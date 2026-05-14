const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, default: false },
});

const quizQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [optionSchema],
  category: String,
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  pointsOnCorrect: { type: Number, default: 10 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('QuizQuestion', quizQuestionSchema);
