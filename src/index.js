const {
  BaseKonnector,
  requestFactory,
  log,
  errors
} = require('cozy-konnector-libs')
const requestJSON = requestFactory({
  debug: false,
  cheerio: false,
  json: true,
  jar: true
})

const urlService = require('./urlService')

let _headers = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'identity',
  'Accept-Language': 'en-US,en',
  'Cache-Control': 'no-cache',
  'Content-Type': 'application/x-www-form-urlencoded'
}

module.exports = new BaseKonnector(start)

async function start(fields) {
  log('info', 'Authenticating ...')
  const token = await authenticate(fields.email, fields.password)
  log('info', 'Successfully logged in')

  log('info', 'Parsing list of documents')
  const documents = await listInvoices(token)

  log('info', 'Saving data to Cozy')
  await this.saveBills(documents, fields, {
    identifiers: ['Shadow'],
    contentType: 'application/pdf'
  })
  // Delete Token
  log('info', 'Login out...')
  await logout(token)
  log('info', 'Successfully logged out')
}

async function authenticate(_email, _password) {
  const $ = await requestJSON({
    method: 'POST',
    url: urlService.getSSOLogin(),
    headers: _headers,
    form: {
      email: _email,
      password: _password
    }
  })

  if ($.statusCode === 403) {
    throw new Error(errors.LOGIN_FAILED)
  } else if ($.statusCode === 500) {
    throw new Error(errors.VENDOR_DOWN)
  }

  // return Token
  return $.result.token
}

async function logout(token) {
  const $ = await requestJSON({
    method: 'DELETE',
    url: urlService.getSSOLogout(token),
    headers: _headers
  })

  if ($.statusCode === 403) {
    throw new Error(errors.USER_ACTION_NEEDED_ACCOUNT_REMOVED)
  } else if ($.statusCode === 500) {
    throw new Error(errors.VENDOR_DOWN)
  }

  return true
}

async function listInvoices(token) {
  // Add header authorization
  _headers.Authorization = token

  let files
  let $ = await getInvoices(token)
  files = $.invoices.data
  while ($.invoices.has_more === true) {
    const last = files[files.length - 1].invoice_date
    $ = await getInvoices(token, last)
    files = files.concat($.invoices.data)
  }

  // remove authorization
  delete _headers.Authorization

  if ($.statusCode === 403) {
    throw new Error(errors.LOGIN_FAILED)
  } else if ($.statusCode === 500) {
    throw new Error(errors.VENDOR_DOWN)
  }

  const invoices = files.map(file => ({
    date: new Date(file.invoice_date),
    amount: normalizePrice(file.paid_amount_cents),
    currency: file.currency,
    filename: `${file.invoice_date}_${file.supplier_name}_${normalizePrice(file.paid_amount_cents)}${file.currency}.pdf`,
    fileurl: file.pdf_file_url,
    vendor: 'Shadow',
    recurrence: 'monthly',
    metadata: {
      created_at: file.invoice_date,
      importDate: new Date(),
      version: 1
    }
  }))

  return invoices
}

async function getInvoices(token, lte = null) {
  const $ = await requestJSON({
    method: 'GET',
    url: urlService.getCustomerInvoices(token, lte),
    headers: _headers
  })

  if ($.statusCode === 403) {
    throw new Error(errors.LOGIN_FAILED)
  } else if ($.statusCode === 500) {
    throw new Error(errors.VENDOR_DOWN)
  }
  return $
}

// Convert a price string to a float
function normalizePrice(price) {
  let amount = price.toString().substr(0, 2)
  let cents = price.toString().substr(2)
  return new Number(`${amount}.${cents}`)
}
