const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizQuestion', required: true },
  selectedOption: Number,
  isCorrect: { type: Boolean, default: false },
  pointsEarned: { type: Number, default: 0 },
}, { timestamps: true });

quizAttemptSchema.index({ user: 1, question: 1 });
quizAttemptSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
