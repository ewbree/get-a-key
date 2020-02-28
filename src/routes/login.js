/*================================================================
LOGIN:
Generate the generic or unique login page based on the URL params
================================================================*/
var express = require('express');
var router = express.Router();
var devAccount = require("../config.js").devAccount;
var serverHostname = require("../config.js").appServer.vhost;
var Account = require("../bin/models/account");
var Customization = require("../bin/models/customization");

/*================================================================
FUNCTION
================================================================*/
function getAccount(req, res, next) {
    // retrieve the account in the DB based on the req params 
    Account
        .findById(req.params.account_id)
        .populate("config")
        .populate("azureAd")
        .populate("adfs")
        .populate("customization")
        .exec(function (err, account) {
            if (err) res.render('error', { error: { message: err } });
            else if (account) {
                // store the usefull data in the user session
                req.session.account = JSON.parse(JSON.stringify(account));
                req.session.xapi = {
                    vpcUrl: account.vpcUrl,
                    accessToken: account.accessToken,
                    ownerId: account.ownerId
                };
                req.session.uurl = account._id;
                req.session.groupId = account.config.userGroupId || 0;
                req.custom = req.session.account.customization;
                req.session.guestGroupId = account.config.guestGroupId || 0;
                // update the user session
                req.session.save(function (err) {
                    next();
                });
            } else res.redirect("/login/");
        });
}

function getDefaultAccount(req, res, next) {
    // retrieve the default account in the DB based on the req params 
    Account
        .findOne({ isDefault: true })
        .populate("config")
        .populate("azureAd")
        .populate("adfs")
        .populate("customization")
        .exec(function (err, account) {
            if (err) res.render('error', { error: { message: err } });
            else if (account) {
                // store the usefull data in the user session
                req.session.account = JSON.parse(JSON.stringify(account));
                req.session.xapi = {
                    vpcUrl: account.vpcUrl,
                    accessToken: account.accessToken,
                    ownerId: account.ownerId
                };
                req.session.uurl = account._id;
                req.session.groupId = account.config.userGroupId || 0;
                req.custom = req.session.account.customization;
                req.session.guestGroupId = account.config.guestGroupId || 0;
                // update the user session
                req.session.save(function (err) {
                    next();
                });
            } else next();
        });
}

function displayEmptyLogin(req, res){
    res.render("login", {
        title: 'Gasten-WiFi iHUB',
        oauthUrl: "https://extremecloudiq.com/thirdpartylogin?client_id=" + devAccount.clientID + "&redirect_uri=" + devAccount.redirectUrl,
        method: null
    });
}

function displayLogin(req, res){
    // determine the authenticaiton method (Azure / ADFS) and generate the corresponding login link
    var method = "";
    if (req.session.account.azureAd) method = "/aad/" + req.session.account._id + "/login";
    else if (req.session.account.adfs) method = "/adfs/" + req.session.account._id + "/login";
    res.render("login", {
        title: 'Gasten-WiFi iHUB',
        oauthUrl: "https://extremecloudiq.com/thirdpartylogin?client_id=" + devAccount.clientID + "&redirect_uri=" + devAccount.redirectUrl,
        method: method,
        custom: req.custom
    });
}

/*================================================================
ROUTES
================================================================*/
// when the user load the unique login page
router.get("/login/:account_id/", getAccount, function (req, res) {
    displayLogin(req, res);
});
// just to be sure. Should never be called...
router.get("/login/:account_id/callback", function (req, res) {
    res.render('error', { error: { message: "It seems the callback URL is misconfigured on your AzureAD or ADFS. Please be sure to use the callback url from the configuration interface." } });
});
// When the generic login page is called
router.get("/login",getDefaultAccount, function (req, res) {
    if (req.session.account && req.session.account.isDefault == true) displayLogin(req, res);
    else displayEmptyLogin(req, res);
});
// When the logout URL is called
router.get("/logout/", function (req, res) {
    var loginurl = require('querystring').escape("https://" + serverHostname + "/login/" + req.session.account._id + "/");
    // if the account is configured with AzureAD, redirect the user to azure logout URL
    if (req.session.account.azureAd) {
        res.redirect("https://login.windows.net/" + req.session.account.azureAd.tenant + "/oauth2/logout?post_logout_redirect_uri=" + loginurl);
    } else if (req.session.account.adfs) {
        res.redirect(req.session.account.adfs.logoutUrl + "?wa=wsignout1.0&wreply=" + loginurl);
    } else res.redirect("/");
    req.logout();
    req.session.destroy();
});

module.exports = router;