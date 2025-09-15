import React from 'react';
import PropTypes from 'prop-types';
import NProgress from 'nprogress';
import Button from '@mui/material/Button';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslation } from 'react-i18next';

import { fetchCheckoutSessionApiMethod } from '../../lib/api/customer';

import notify from '../../lib/notify';

const styleBuyButton = {
  margin: '10px 20px 0px 0px',
};

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.NEXT_PUBLIC_PORT || 8000;
const ROOT_URL = `http://localhost:${port}`;

const stripePromise = loadStripe(
  dev
    ? process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLEKEY
    : process.env.NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLEKEY,
);

const propTypes = {
  book: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    textNearButton: PropTypes.string,
  }),
  user: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
  }),
  redirectToCheckout: PropTypes.bool,
};

const defaultProps = {
  book: null,
  user: null,
  redirectToCheckout: false,
};

function BuyButton(props) {
  const { t } = useTranslation();
  const { book, user, redirectToCheckout } = props;

  React.useEffect(() => {
    if (redirectToCheckout) {
      handleCheckoutClick();
    }
  }, [redirectToCheckout]);

  const onLoginClicked = () => {
    if (!user) {
      const redirectUrl = `${window.location.pathname}?buy=1`;
      window.location.href = `${ROOT_URL}/auth/google?redirectUrl=${redirectUrl}`;
    }
  };

  const handleCheckoutClick = async () => {
    NProgress.start();

    try {
      const { sessionId } = await fetchCheckoutSessionApiMethod({
        bookId: book._id,
        redirectUrl: document.location.pathname,
      });

      // When the customer clicks on the button, redirect them to Checkout.
      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        notify(error);
      }
    } catch (err) {
      notify(err);
    } finally {
      NProgress.done();
    }
  };

  if (!book) {
    return null;
  }

  if (!user) {
    return (
      <div>
        <Button
          variant="contained"
          color="primary"
          style={styleBuyButton}
          onClick={onLoginClicked}
        >
          {t("button.buy_book", { price: book.price })}
        </Button>
        <p style={{ verticalAlign: 'middle', fontSize: '15px' }}>{book.textNearButton}</p>
        <hr />
      </div>
    );
  }
  return (
    <div>
      <Button
        variant="contained"
        color="primary"
        style={styleBuyButton}
        onClick={handleCheckoutClick}
      >
        {t("button.buy_book", { price: book.price })}
      </Button>
      <p style={{ verticalAlign: 'middle', fontSize: '15px' }}>{book.textNearButton}</p>
      <hr />
    </div>
  );
}

BuyButton.propTypes = propTypes;
BuyButton.defaultProps = defaultProps;

export default BuyButton;