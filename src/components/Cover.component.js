'use strict';

/**
 * @file
 * Load cover image for a work
 */

import React from 'react';
import CoverStore from '../stores/CoverImage.store.js';
import CoverActions from '../actions/CoverImage.action.js';

/**
 * Get image with size
 *
 * Runs though an array of images and returns the image with a certain size
 *
 * @param {array} images
 * @param {string} size
 * @returns {string}
 * @private
 */
function _getImage(images, size) {
  return images.filter((image) => image.size === size).pop().url;
}


const Cover = React.createClass({
  propTypes: {
    pids: React.PropTypes.array.isRequired
  },

  getInitialState() {
    const images = CoverStore.getStore().images.get(this.props.pids[0]);
    if (typeof images === 'undefined') {
      CoverActions(this.props.pids);
    }
    return {
      images,
      pids: this.props.pids
    };
  },
  updateImage(coverStore) {
    const images = coverStore.images.get(this.props.pids[0]);
    this.setState({images});
  },

  componentDidMount() {
    CoverStore.listen(this.updateImage);
  },

  render() {
    const {images} = this.state;
    let image;
    if (typeof images !== 'undefined') {
      const url = _getImage(images.images, 'detail_500');
      image = <img src={url} />;
    }

    return (
      <div className='cover' >
        {image}
      </div>
    );
  }
});

export default Cover;