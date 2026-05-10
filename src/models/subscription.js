export default class Subscription {
  constructor({ email, repo, confirmed, last_seen_tag }) {
    this.email = email;
    this.repo = repo;
    this.confirmed = Boolean(confirmed);
    this.last_seen_tag = last_seen_tag;
  }
}