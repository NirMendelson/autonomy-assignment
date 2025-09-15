import React from 'react';
import PropTypes from 'prop-types';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';

import withAuth from '../lib/withAuth';

const propTypes = {
  user: PropTypes.shape({
    displayName: PropTypes.string,
    email: PropTypes.string.isRequired,
  }),
};

const defaultProps = {
  user: null,
};

// eslint-disable-next-line react/prefer-stateless-function
class Index extends React.Component {
  render() {
    const { user, t } = this.props;
    return (
      <div style={{ padding: '10px 45px' }}>
        <Head>
          <title>{t('page.title')}</title>
          <meta name="description" content={t('meta.description')} />
        </Head>
        <p>{t('heading.purchased_books')}</p>
        <p>{t('label.email')}&nbsp;{user.email}</p>
      </div>
    );
  }
}

Index.propTypes = propTypes;
Index.defaultProps = defaultProps;

function IndexWithTranslation(props) {
  const { t } = useTranslation();
  return <Index {...props} t={t} />;
}

export default withAuth(IndexWithTranslation);