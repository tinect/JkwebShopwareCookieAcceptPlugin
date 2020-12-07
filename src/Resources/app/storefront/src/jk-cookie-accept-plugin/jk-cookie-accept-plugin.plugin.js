import Plugin from 'src/plugin-system/plugin.class';
import { COOKIE_CONFIGURATION_UPDATE } from 'src/plugin/cookie/cookie-configuration.plugin';
import ElementLoadingIndicatorUtil from 'src/utility/loading-indicator/element-loading-indicator.util';
import HttpClient from 'src/service/http-client.service';
import CookieStorage from 'src/helper/storage/cookie-storage.helper';

export default class JkCookieAcceptPlugin extends Plugin {
    static options = {
        acceptButtonSelector: '.js-cookie-accept-button',
        acceptButtonLoadingIndicatorSelector: '.js-cookie-accept-button-loading-indicator'
    };

    init() {
        const me = this;
        me.cookieConfiguration = window.PluginManager.getPluginInstances('CookieConfiguration')[0];

        document.$emitter.subscribe(COOKIE_CONFIGURATION_UPDATE, (ev) => {
            const detail = ev.detail;
            for (const cookie in detail) {
                if (detail.hasOwnProperty(cookie)) {
                    if (typeof(window.dataLayer) !== 'undefined' && Array.isArray(window.dataLayer)) {
                        if (detail[cookie]) {
                            window.dataLayer.push({
                                'event': 'enableCookie',
                                'name': cookie
                            });
                        } else {
                            window.dataLayer.push({
                                'event': 'disableCookie',
                                'name': cookie
                            });
                        }
                    }
                }
            }
        });

        const button = document.querySelector(this.options.acceptButtonSelector + ':not(.disabled)');
        me._registerClickEvent(button);
    }

    _registerClickEvent(el) {
        el.addEventListener('click', () => {
            const me = this;

            const btn = el.querySelector('button');
            btn.classList.add('disabled');

            const loadingIndicatorElement = btn.querySelector(this.options.acceptButtonLoadingIndicatorSelector);
            ElementLoadingIndicatorUtil.create(loadingIndicatorElement);

            const url = window.router['frontend.cookie.offcanvas'];
            const client = new HttpClient(window.accessKey, window.contextToken);
            client.get(url, (data) => {
                const dataContext = $(`<div>${data}</div>`);
                me._setInitialState(dataContext, me.cookieConfiguration);
                const activeCookies = me._getCookies(dataContext, me.cookieConfiguration, 'all');
                const activeCookieNames = [];

                activeCookies.forEach(({ cookie, value, expiration }) => {
                    activeCookieNames.push(cookie);

                    if (cookie && value) {
                        CookieStorage.setItem(cookie, value, expiration);
                    }
                });

                CookieStorage.setItem(me.cookieConfiguration.options.cookiePreference, '1', 30);

                me.cookieConfiguration._handleUpdateListener(activeCookieNames, []);

                btn.classList.remove('disabled');
                ElementLoadingIndicatorUtil.remove(loadingIndicatorElement);
                me.cookieConfiguration._hideCookieBar();

                if (window.COOKIE_ACCEPT_RELOAD === 1) {
                    location.reload();
                }
            });
        }, false);
    }

    _setInitialState(ctx, cookieConfiguration) {
        const cookies = this._getCookies(ctx, cookieConfiguration, 'all');
        const activeCookies = [];
        const inactiveCookies = [];

        cookies.forEach(({ cookie, required }) => {
            const isActive = CookieStorage.getItem(cookie);
            if (isActive || required) {
                activeCookies.push(cookie);
            } else {
                inactiveCookies.push(cookie);
            }
        });

        cookieConfiguration.lastState = {
            active: activeCookies,
            inactive: inactiveCookies
        };

        activeCookies.forEach(activeCookie => {
            const target = document.querySelector(`[data-cookie="${activeCookie}"]`);

            target.checked = true;
            cookieConfiguration._childCheckboxEvent(target);
        });
    }

    _getCookies(ctx, cookieConfiguration, type = 'all') {
        return Array.from($(this.cookieConfiguration.options.cookieSelector, ctx)).filter(cookieInput => {
            switch (type) {
                case 'all': return true;
                case 'active': return cookieConfiguration._isChecked(cookieInput);
                case 'inactive': return !cookieConfiguration._isChecked(cookieInput);
                default: return false;
            }
        }).map(filteredInput => {
            const { cookie, cookieValue, cookieExpiration, cookieRequired } = filteredInput.dataset;
            return { cookie, value: cookieValue, expiration: cookieExpiration, required: cookieRequired };
        });
    }
}
