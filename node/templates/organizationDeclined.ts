const MESSAGE_BODY =
  '<!DOCTYPE html PUBLIC \'-//W3C//DTD XHTML 1.0 Transitional//EN\' \'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\'>\n<html>\n  <head>\n    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />\n    <meta charset="utf-8" />\n    <!-- Facebook sharing information tags -->\n    <meta property="og:title" content="*|MC:SUBJECT|*" />\n\n    <title>{{_accountInfo.TradingName}}</title>\n  </head>\n  <body\n    leftmargin="0"\n    marginwidth="0"\n    topmargin="0"\n    marginheight="0"\n    offset="0"\n  >\n    <center>\n      <table\n        border="0"\n        cellpadding="0"\n        cellspacing="0"\n        height="100%"\n        width="100%"\n        style=""\n      >\n        <tr>\n          <td align="center" valign="top">\n            <table border="0" cellpadding="0" cellspacing="0" width="700">\n              <tr>\n                <td align="center" valign="top">\n                  <!-- // Begin Template Body \\\\ -->\n                  <table border="0" cellpadding="0" cellspacing="0" width="700">\n                    <!-- <tr>\n                      <td style="width: 100%;">\n                        <a\n                          href="http://{{_accountInfo.HostName}}.com.br"\n                          target="_blank"\n                        >\n                          <img\n                            src="http://licensemanager.vtex.com.br/api/site/pub/accounts/{{_accountInfo.Id}}/logos/show"\n                            border="0"\n                            alt="{{_accountInfo.TradingName}}"\n                            style="max-width: 100px;"\n                          />\n                        </a>\n                      </td>\n                    </tr> -->\n                    <tr>\n                      <td valign="top">\n                        <br />\n                        <table\n                          border="0"\n                          cellspacing="0"\n                          width="100%"\n                          style="border-top: solid 1px #c1c1c1;"\n                        >\n                          <!-- // Header content \\\\ -->\n                          <tr>\n                            <td valign="top" style="font-size: 13px;">\n                              <br />\n                              <p>\n                                Hello, <strong>{{organization.admin}}</strong>.\n                              </p>\n                              <p>\n                                The organization request for\n                                {{organization.name}} has been declined.<br />\n                              </p>\n\n                              {{#if organization.note}}\n                              <p>Admin comments:<br /></p>\n                              <blockquote>\n                                <p>\n                                  {{organization.note}}\n                                </p>\n                              </blockquote>\n                              {{/if}}\n\n                              <br />\n                            </td>\n                          </tr>\n                        </table>\n                        <!-- // End Module: Standard Content \\\\ -->\n                      </td>\n                    </tr>\n                  </table>\n                  <!-- // End Template Body \\\\ -->\n                </td>\n              </tr>\n              <tr>\n                <td align="center" valign="top">\n                  <!-- // Begin Template Footer \\\\ -->\n                  <table\n                    border="0"\n                    cellspacing="0"\n                    width="700"\n                    style="border-top: 3px solid #f2f2f2;"\n                  >\n                    <tr>\n                      <td valign="top" style="font-size: 13px;">\n                        <br />\n                        <p>\n                          <!-- Atenciosamente,<br /> -->\n                          {{_accountInfo.TradingName}}\n                        </p>\n                      </td>\n                    </tr>\n                  </table>\n                  <!-- // End Template Footer \\\\ -->\n                </td>\n              </tr>\n            </table>\n            <br />\n          </td>\n        </tr>\n      </table>\n    </center>\n  </body>\n</html>\n'

export const organizationDeclinedMessage = {
  Name: 'organization-declined',
  FriendlyName: 'Organization Declined',
  // Description: null,
  IsDefaultTemplate: false,
  // AccountId: null,
  // AccountName: null,
  // ApplicationId: null,
  IsPersisted: true,
  IsRemoved: false,
  Type: '',
  Templates: {
    email: {
      To: '{{message.to}}',
      // CC: null,
      // BCC: null,
      Subject: 'Organization Declined',
      Message: MESSAGE_BODY,
      Type: 'E',
      ProviderId: '00000000-0000-0000-0000-000000000000',
      // ProviderName: null,
      IsActive: true,
      withError: false,
    },
    sms: {
      Type: 'S',
      // ProviderId: null,
      // ProviderName: null,
      IsActive: false,
      withError: false,
      Parameters: [],
    },
  },
}
