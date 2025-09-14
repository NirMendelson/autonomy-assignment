import React from 'react';
import { useTranslation } from 'react-i18next';
import Snackbar from '@mui/material/Snackbar';

let openSnackbarFn;

class NotifierClass extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      open: false,
      message: '',
    };
  }

  componentDidMount() {
    openSnackbarFn = this.openSnackbar;
  }

  handleSnackbarRequestClose = () => {
    this.setState({
      open: false,
      message: '',
    });
  };

  openSnackbar = ({ message }) => {
    this.setState({ open: true, message });
  };

  render() {
    const { t } = this.props;
    const message = (
      <span id="snackbar-message-id" dangerouslySetInnerHTML={{ __html: this.state.message }} />
    );

    return (
      <Snackbar
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={this.state.open}
        message={message}
        autoHideDuration={5000}
        onClose={this.handleSnackbarRequestClose}
        ContentProps={{
          'aria-describedby': 'snackbar-message-id',
        }}
      />
    );
  }
}

function Notifier(props) {
  const { t } = useTranslation();
  return <NotifierClass {...props} t={t} />;
}

export function openSnackbarExported({ message }) {
  openSnackbarFn({ message });
}

export default Notifier;