'use strict';

/**
 * @file
 * TopNavigation displays a logo and a navigation menu in the top of the page.
 */

import React from 'react';
import ProfileStore from '../../stores/Profile.store.js';
import ProfileActions from '../../actions/Profile.action.js';

const TopNavigation = React.createClass({

  displayName: function() {
    return 'ReactTopNavigation';
  },

  getInitialState() {
    return {
      isLoggedIn: null,
      username: ''
    };
  },

  componentDidMount: function() {
    ProfileStore.listen(this.updateProfile);
    ProfileActions.fetchProfile();
  },

  updateProfile: function(profile) {
    this.setState({
      isLoggedIn: profile.userIsLoggedIn,
      username: profile.name
    });
  },

  render: function() {
    const isLoggedIn = this.state.isLoggedIn;
    const buttonData = isLoggedIn ? {url: '/profile/logout', text: 'Log Ud'} : {url: '/profile/login', text: 'Log Ind'};

    const profileLink = isLoggedIn ? <a href='/profile' >{this.state.username}</a> : '';

    return (
      <nav className='topnavigation--header' role="navigation" >
        <div className='row' >
          <div className='small-16 columns topnavigation--header--buttons' >
            <div className='left topnavigation--header--buttons--profilelink' >
              {profileLink}
            </div>
            <div className='right' >
              <a className='button tiny' href={buttonData.url} >{buttonData.text}</a>
            </div>
          </div>
        </div>
      </nav>
    );
  }
});

export default TopNavigation;
