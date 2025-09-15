import React from 'react';
import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Input from '@mui/material/Input';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useTranslation } from 'react-i18next';

import { getGithubReposApiMethod } from '../../lib/api/admin';
import { styleTextField } from '../SharedStyles';
import notify from '../../lib/notify';

const propTypes = {
  book: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }),
  onSave: PropTypes.func.isRequired,
};

const defaultProps = {
  book: null,
};

class EditBook extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      book: props.book || {},
      repos: [],
    };
  }

  async componentDidMount() {
    try {
      const { repos } = await getGithubReposApiMethod();
      this.setState({ repos }); // eslint-disable-line
    } catch (err) {
      console.log(err); // eslint-disable-line
    }
  }

  onSubmit = (event) => {
    event.preventDefault();
    const { name, price, githubRepo } = this.state.book;
    const { t } = this.props;

    if (!name) {
      notify(t('error.name_required'));
      return;
    }

    if (!price) {
      notify(t('error.price_required'));
      return;
    }

    if (!githubRepo) {
      notify(t('error.github_repo_required'));
      return;
    }

    this.props.onSave(this.state.book);
  };

  render() {
    const { t } = this.props;

    return (
      <div style={{ padding: '10px 45px' }}>
        <form onSubmit={this.onSubmit}>
          <br />
          <div>
            <TextField
              onChange={(event) => {
                this.setState({
                  // eslint-disable-next-line
                  book: { ...this.state.book, name: event.target.value },
                });
              }}
              value={this.state.book.name}
              type="text"
              label={t('label.book_title')}
              style={styleTextField}
            />
          </div>
          <br />
          <br />
          <TextField
            onChange={(event) => {
              this.setState({
                // eslint-disable-next-line
                book: { ...this.state.book, price: Number(event.target.value) },
              });
            }}
            value={this.state.book.price}
            type="number"
            label={t('label.book_price')}
            className="textFieldInput"
            style={styleTextField}
            step="1"
          />
          <br />
          <br />
          <div>
            <span>{t('label.github_repo')}</span>
            <Select
              value={this.state.book.githubRepo || ''}
              input={<Input />}
              onChange={(event) => {
                event.stopPropagation();
                this.setState({
                  // eslint-disable-next-line
                  book: { ...this.state.book, githubRepo: event.target.value },
                });
              }}
            >
              <MenuItem value="">
                <em>{t('menu.choose_github_repo')}</em>
              </MenuItem>
              {this.state.repos.map((r) => (
                <MenuItem value={r.full_name} key={r.id}>
                  {r.full_name}
                </MenuItem>
              ))}
            </Select>
          </div>
          <br />
          <br />
          <Button variant="contained" color="primary" type="submit">
            {t('button.save')}
          </Button>
        </form>
      </div>
    );
  }
}

EditBook.propTypes = propTypes;
EditBook.defaultProps = defaultProps;

function EditBookWithTranslation(props) {
  const { t } = useTranslation();
  return <EditBook {...props} t={t} />;
}

export default EditBookWithTranslation;