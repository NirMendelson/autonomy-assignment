import Head from {t({t('login.title')})};
import { withRouter } from 'next/router';
import PropTypes from 'prop-types';
import Button from '@mui/material/Button';

import withAuth from '../../lib/withAuth';

const propTypes = {
  router: PropTypes.shape({
    query: PropTypes.shape({
      redirectUrl: PropTypes.string,
    }),
  }).isRequired,
};

function Login({ router }) {
  const redirectUrl = (router && router.query && router.query.redirectUrl) || '';

  return (
    <div style={{ textAlign: 'center', margin: '0 20px' }}>
      <Head>
        <title>Log in to Builder Book</title>
        <meta name="description" content={t({t('page.description.loginPage')})} />
      </Head>
      <br />
      <p style={{ margin: {t('login.title')}, fontSize: '44px', fontWeight: '400' }}>Log in</p>
      <p>You’ll be logged in for 14 days unless you log out manually.</p>
      <br />
      <Button
        variant="contained"
        color="secondary"
        href={`/auth/google?redirectUrl=${redirectUrl}`}
      >
        <img
          src="https://builderbook-public.s3.amazonaws.com/G.svg"
          alt={t({t('common.button.loginWithGoogle')})}
          style={{ marginRight: '10px' }}
        />
        Log in with Google
      </Button>
    </div>
  );
}

Login.propTypes = propTypes;

export default withAuth(withRouter(Login), { logoutRequired: true });
