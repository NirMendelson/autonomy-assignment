import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    handleClose();
  };

  const getCurrentLanguage = () => {
    return i18n.language === 'es' ? 'Español' : 'English';
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant="outlined"
        size="small"
        sx={{ minWidth: 100 }}
      >
        {getCurrentLanguage()}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
      >
        <MenuItem onClick={() => changeLanguage('en')}>English</MenuItem>
        <MenuItem onClick={() => changeLanguage('es')}>Español</MenuItem>
      </Menu>
    </>
  );
};

export default LanguageSwitcher;