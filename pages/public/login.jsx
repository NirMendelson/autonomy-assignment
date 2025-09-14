import Head from 'next/head';
import { withRouter } from 'next/router';
import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import { useTranslation } from 'next-i18next';

import withAuth from '../../lib/withAuth';

const propTypes = {
  router: PropTypes.shape({
    query: PropTypes.shape({
      redirectUrl: PropTypes.string,
    }),
  }).isRequired,
};

function Login({ router }) {
  const { t } = useTranslation();
  const redirectUrl = (router && router.query && router.query.redirectUrl) || '';

  return (
    <div style={{ textAlign: 'center', margin: '0 20px' }}>
      <Head>
        <title>{t('title.login_page')}</title>
        <meta name="description" content={t('meta.description.login_page')} />
      </Head>
      <br />
      <p style={{ margin: '45px auto', fontSize: '44px', fontWeight: '400' }}>{t('visible.text.log_in')}</p>
      <p>{t('visible.text.login_duration')}</p>
      <br />
      <Button
        variant="contained"
        color="secondary"
        href={`/auth/google?redirectUrl=${redirectUrl}`}
      >
        <img
          src="https://builderbook-public.s3.amazonaws.com/G.svg"
          alt={t('alt.login_with_google')}
          style={{ marginRight: '10px' }}
        />
        {t('button.login_with_google')}
      </Button>
    </div>
  );
}

Login.propTypes = propTypes;

export default withAuth(withRouter(Login), { logoutRequired: true });