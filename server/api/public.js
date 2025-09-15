const express = require('express');
// const Book = require('../models/Book'); // Commented out for mocking
// const Chapter = require('../models/Chapter'); // Commented out for mocking

const router = express.Router();

// Note: This is a server-side Express.js file, not a React component
// i18n implementation for server-side translations using a mock translation function
// In production, this would use libraries like i18next or similar

// Server-side i18n implementation
const getTranslation = (key, locale = 'en') => {
  // This would be replaced with actual i18n implementation
  const translations = {
    'book.mock_book_1': 'Mock Book 1',
    'chapter.mock_chapter_1': 'Mock Chapter 1',
    'content.mock_chapter_content': 'This is mock chapter content.',
    'chapter.introduction': 'Introduction',
    'chapter.mock_chapter_2': 'Mock Chapter 2',
  };
  return translations[key] || key;
};

const t = getTranslation; // Alias for easier use

router.get('/books', async (req, res) => {
  // try { // Commented out for mocking
  //   const books = await Book.list(); // Commented out for mocking
  //   res.json(books);
  // } catch (err) {
  //   res.json({ error: err.message || err.toString() });
  // }
  // Mock data:
  res.json([
    {
      _id: 'mockbook1',
      name: t('book.mock_book_1'),
      slug: 'mock-book-1',
      price: 10,
      createdAt: new Date(),
      githubRepo: 'mock/repo1',
      githubLastCommitSha: 'mocksha1',
    },
  ]);
});

router.get('/books/:slug', async (req, res) => {
  // try { // Commented out for mocking
  //   const book = await Book.getBySlug({ slug: req.params.slug }); // Commented out for mocking
  //   res.json(book);
  // } catch (err) {
  //   res.json({ error: err.message || err.toString() });
  // }
  // Mock data:
  res.json({
    _id: 'mockbook1',
    name: t('book.mock_book_1'),
    slug: req.params.slug,
    price: 10,
    createdAt: new Date(),
    githubRepo: 'mock/repo1',
    githubLastCommitSha: 'mocksha1',
    chapters: [
      {
        _id: 'mockchapter1',
        title: t('chapter.mock_chapter_1'),
        slug: 'mock-chapter-1',
        isFree: true,
        order: 1,
      },
    ],
  });
});

router.get('/get-chapter-detail', async (req, res) => {
  // try { // Commented out for mocking
  //   const { bookSlug, chapterSlug } = req.query;
  //   const chapter = await Chapter.getBySlug({ // Commented out for mocking
  //     bookSlug,
  //     chapterSlug,
  //     userId: req.user && req.user.id,
  //     isAdmin: req.user && req.user.isAdmin,
  //   });
  //   res.json(chapter);
  // } catch (err) {
  //   res.json({ error: err.message || err.toString() });
  // }
  // Mock data:
  res.json({
    _id: 'mockchapter1',
    title: t('chapter.mock_chapter_1'),
    slug: req.query.chapterSlug,
    htmlContent: `<p>${t('content.mock_chapter_content')}</p>`,
    isFree: true,
    order: 1,
    book: {
      _id: 'mockbook1',
      name: t('book.mock_book_1'),
      slug: req.query.bookSlug,
      chapters: [
        {
          _id: 'mockintrochapter',
          title: t('chapter.introduction'),
          slug: 'introduction',
          order: 0,
        },
        {
          _id: 'mockchapter1',
          title: t('chapter.mock_chapter_1'),
          slug: 'mock-chapter-1',
          order: 1,
        },
        {
          _id: 'mockchapter2',
          title: t('chapter.mock_chapter_2'),
          slug: 'mock-chapter-2',
          order: 2,
        },
      ],
    },
  });
});

module.exports = router;