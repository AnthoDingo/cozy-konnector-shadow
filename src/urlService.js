const moment = require('moment')

class UrlService {
  constructor() {
    this.scheme = `https`

    this.domain = `api-web.shadow.tech`

    this.sso = `${this.scheme}://sso.${this.domain}`
    this.ssoLogin = `${this.sso}/api/v1/user/login`
    this.ssoLogout = `${this.sso}/api/v1/user/logout`

    this.customer = `${this.scheme}://customer.${this.domain}`
    this.customerInvoices = `${this.customer}/api/v1/customer/invoices`
  }

  getSSOLogin() {
    return this.ssoLogin
  }
  getSSOLogout(token) {
    return `${this.ssoLogout}/${token}`
  }

  getCustomerInvoices(token, lte = null) {
    if (lte === null) {
      lte = encodeURIComponent(moment().format('YYYY-MM-DD'))
    }
    return `${this.customerInvoices}/${token}?gte=2011-10-05&lte=${lte}`
  }
}

module.exports = new UrlService()
