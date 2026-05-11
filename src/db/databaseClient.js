/**
 * Abstract database client contract.
 *
 * This class defines the interface that concrete database client implementations
 * must fulfill. It is not meant to be instantiated directly.
 *
 * @interface
 */
export default class DatabaseClient {
  /**
   * Initialize or migrate the database schema.
   * @abstract
   * @returns {Promise<void>}
   */
  async initSchema() {
    throw new Error('initSchema() must be implemented by a database client subclass');
  }

  /**
   * Find a repository by full name.
   * @abstract
   * @param {string} _fullName
   * @returns {Promise<*>}
   */
  async getRepositoryByFullName(_fullName) {
    throw new Error('getRepositoryByFullName() must be implemented by a database client subclass');
  }

  /**
   * Create repository tracking state.
   * @abstract
   * @param {string} _fullName
   * @param {string|null} _lastSeenTag
   * @returns {Promise<*>}
   */
  async createRepository(_fullName, _lastSeenTag) {
    throw new Error('createRepository() must be implemented by a database client subclass');
  }

  /**
   * Get a subscription by email and repository.
   * @abstract
   * @param {string} _email
   * @param {number} _repoId
   * @returns {Promise<*>}
   */
  async getSubscriptionByEmailAndRepoId(_email, _repoId) {
    throw new Error('getSubscriptionByEmailAndRepoId() must be implemented by a database client subclass');
  }

  /**
   * Create a new subscription.
   * @abstract
   * @param {string} _email
   * @param {number} _repoId
   * @param {string} _confirmToken
   * @param {string} _unsubscribeToken
   * @returns {Promise<*>}
   */
  async createSubscription(_email, _repoId, _confirmToken, _unsubscribeToken) {
    throw new Error('createSubscription() must be implemented by a database client subclass');
  }

  /**
   * Get a subscription by confirmation token.
   * @abstract
   * @param {string} _token
   * @returns {Promise<*>}
   */
  async getSubscriptionByConfirmToken(_token) {
    throw new Error('getSubscriptionByConfirmToken() must be implemented by a database client subclass');
  }

  /**
   * Mark subscription as confirmed.
   * @abstract
   * @param {number} _id
   * @returns {Promise<*>}
   */
  async updateSubscriptionConfirmed(_id) {
    throw new Error('updateSubscriptionConfirmed() must be implemented by a database client subclass');
  }

  /**
   * Get a subscription by unsubscribe token.
   * @abstract
   * @param {string} _token
   * @returns {Promise<*>}
   */
  async getSubscriptionByUnsubscribeToken(_token) {
    throw new Error('getSubscriptionByUnsubscribeToken() must be implemented by a database client subclass');
  }

  /**
   * Delete a subscription by ID.
   * @abstract
   * @param {number} _id
   * @returns {Promise<*>}
   */
  async deleteSubscriptionById(_id) {
    throw new Error('deleteSubscriptionById() must be implemented by a database client subclass');
  }

  /**
   * Count subscriptions for a repository.
   * @abstract
   * @param {number} _repoId
   * @returns {Promise<number>}
   */
  async countSubscriptionsByRepoId(_repoId) {
    throw new Error('countSubscriptionsByRepoId() must be implemented by a database client subclass');
  }

  /**
   * Delete a repository record by ID.
   * @abstract
   * @param {number} _id
   * @returns {Promise<*>}
   */
  async deleteRepositoryById(_id) {
    throw new Error('deleteRepositoryById() must be implemented by a database client subclass');
  }

  /**
   * List subscriptions for an email.
   * @abstract
   * @param {string} _email
   * @returns {Promise<Array<*>>}
   */
  async getSubscriptionsByEmail(_email) {
    throw new Error('getSubscriptionsByEmail() must be implemented by a database client subclass');
  }

  /**
   * List confirmed repositories.
   * @abstract
   * @returns {Promise<Array<*>>}
   */
  async getConfirmedRepositories() {
    throw new Error('getConfirmedRepositories() must be implemented by a database client subclass');
  }

  /**
   * Get confirmed subscriptions for a repository.
   * @abstract
   * @param {number} _repoId
   * @returns {Promise<Array<*>>}
   */
  async getConfirmedSubscriptionsByRepoId(_repoId) {
    throw new Error('getConfirmedSubscriptionsByRepoId() must be implemented by a database client subclass');
  }

  /**
   * Update repository last seen tag.
   * @abstract
   * @param {number} _repoId
   * @param {string|null} _lastSeenTag
   * @returns {Promise<*>}
   */
  async updateRepositoryLastSeenTag(_repoId, _lastSeenTag) {
    throw new Error('updateRepositoryLastSeenTag() must be implemented by a database client subclass');
  }
}
