import React from 'react';
import Router from 'next/router';
import NProgress from 'nprogress';
import { useTranslation } from 'next-i18next';

import withAuth from '../../lib/withAuth';
import EditBook from '../../components/admin/EditBook';
import { addBookApiMethod, syncBookContentApiMethod } from '../../lib/api/admin';
import notify from '../../lib/notify';

function AddBook() {
  const { t } = useTranslation();

  const addBookOnSave = async (data) => {
    NProgress.start();

    try {
      const book = await addBookApiMethod(data);
      notify(t('notification.saved'));
      try {
        const bookId = book._id;
        await syncBookContentApiMethod({ bookId });
        notify(t('notification.synced'));
        NProgress.done();
        Router.push(`/admin/book-detail?slug=${book.slug}`, `/admin/book-detail/${book.slug}`);
      } catch (err) {
        notify(err.message || err.toString());
        NProgress.done();
      }
    } catch (err) {
      notify(err.message || err.toString());
      NProgress.done();
    }
  };

  return (
    <div style={{ padding: '10px 45px' }}>
      <EditBook onSave={addBookOnSave} />
    </div>
  );
}

export default withAuth(AddBook, { adminRequired: true });