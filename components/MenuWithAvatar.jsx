import React from 'react';
import PropTypes from 'prop-types';
import Link from 'next/link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import { useTranslation } from 'react-i18next';

const propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(Object).isRequired,
};

class MenuWithAvatar extends React.Component {
  constructor() {
    super();

    this.state = {
      anchorEl: undefined,
    };
  }

  handleClick = (event) => {
    this.setState({ anchorEl: event.currentTarget });
  };

  handleClose = () => {
    this.setState({ anchorEl: null });
  };

  render() {
    const { options, src, alt, t } = this.props;
    const { anchorEl } = this.state;

    return (
      <div>
        <Avatar
          aria-controls={anchorEl ? 'simple-menu' : null}
          aria-haspopup="true"
          onClick={this.handleClick}
          onKeyPress={this.handleClick}
          src={src}
          alt={alt === 'original' ? t('alt.avatar') : alt}
          style={{ margin: '0px 20px 0px auto', cursor: 'pointer' }}
        />
        <Menu
          id="simple-menu"
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={this.handleClose}
          keepMounted
        >
          {options.map((option) => (
            <div id="wrappingLink" key={option.text}>
              {option.anchor ? (
                <MenuItem
                  onClick={(event) => {
                    event.preventDefault();
                    window.location.href = option.href;
                    this.handleClose();
                  }}
                >
                  {option.text === 'option.text' ? t('menu.option_text') : option.text}
                </MenuItem>
              ) : (
                <Link href={option.href} as={option.as || option.href}>
                  <MenuItem>{option.text === 'option.text' ? t('menu.option_text') : option.text}</MenuItem>
                </Link>
              )}
            </div>
          ))}
        </Menu>
      </div>
    );
  }
}

const MenuWithAvatarWrapper = (props) => {
  const { t } = useTranslation();
  return <MenuWithAvatar {...props} t={t} />;
};

MenuWithAvatarWrapper.propTypes = propTypes;

export default MenuWithAvatarWrapper;