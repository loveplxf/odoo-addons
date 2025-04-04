# -*- coding: utf-8 -*-
from odoo import http, models, fields, api
from odoo.http import request
import json


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    @classmethod
    def _auth_method_apikey(cls):
        # api_key = request.httprequest.headers.get("Authorization")
        data = json.loads(request.httprequest.data)
        if 'api_key' not in data:
            raise http.SessionExpiredException("API key not in POST data")
        api_key = data['openid']
        user_id = request.env["res.users.apikeys"]._check_credentials(
            scope="rpc", key=api_key
        )
        if not user_id:
            raise http.SessionExpiredException("API key invalid")

        request.uid = user_id

    @classmethod
    def _auth_method_openid(cls):
        # openid = request.httprequest.headers.get("Authorization")
        data = json.loads(request.httprequest.data)
        if 'openid' not in data:
            raise http.SessionExpiredException("OpenID not in POST data")
        openid = data['openid']
        employee = request.env['hr.employee'].sudo().search([["visa_no", "=", openid]], limit=1)
        if not employee:
            raise http.SessionExpiredException("OpenID not found in employee setting")
        if not employee.permit_no:
            raise http.SessionExpiredException("ApiKey not found in employee setting")
        api_key = employee.permit_no
        user_id = request.env["res.users.apikeys"]._check_credentials(
            scope="rpc", key=api_key
        )
        if not user_id:
            raise http.SessionExpiredException("API key invalid")

        request.uid = user_id
