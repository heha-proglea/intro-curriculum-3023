'use strict';
const pug = require('pug');
const Cookies = require('cookies');
const util = require('./handler-util');
const Post = require('./post');

const trackingIdKey = 'tracking_id'; // Cookie名の宣言

function handle(req, res) {
  const cookies = new Cookies(req, res); // cookiesオブジェクトの作成
  addTrackingCookie(cookies); // addTrackingCookie関数の呼び出し

  switch (req.method) {
    case 'GET':
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      Post.findAll({ order: [['id', 'DESC']] }).then((posts) => {
        res.end(pug.renderFile('./views/posts.pug', {
          posts: posts
        }));
        // 閲覧情報をサーバーのログに出力(ユーザー名,トラッキングID,リモートアドレス(クライアントのIPアドレス),ユーザーエージェント)
        console.info(
          `閲覧されました: user: ${req.user}, ` +
          `trackingId: ${cookies.get(trackingIdKey) },` +
          `remoteAddress: ${req.connection.remoteAddress},` +
          `userAgent: ${req.headers['user-agent']}`
        );
      });
      break;
    case 'POST':
      let body = [];
      req.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();
        const decoded = decodeURIComponent(body);
        const content = decoded.split('content=')[1];
        console.info('投稿されました: ' + content);
        Post.create({
          content: content,
          // trackingCookie: null,
          trackingCookie: cookies.get(trackingIdKey), // CookieのトラッキングIDを取得して、データベースに保存
          postedBy: req.user
        }).then(() => {
          handleRedirectPosts(req, res);
        });
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

function addTrackingCookie(cookies) {
  if (!cookies.get(trackingIdKey)) { // 「名前がtrackingIdKeyであるCookieの値」をget関数で取得。それがfalsyな場合(値が無い等)trueを返す
    // トラッキングID用に ランダムな指数値を生成
    const trackingId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    // 現在から24時間後のミリ秒を取得し、Dataオブジェクトに変換
    const tomorrow = new Date(new Date().getTime() + (1000 * 60 * 60 * 24));
    // トラッキングIDについて(Cookie名, Cookie値, { expires: 有効期限})の形で記述し、Cookieとして設定する(記述方法はcookiesモジュールのAPIに従っている)
    cookies.set(trackingIdKey, trackingId, { expires: tomorrow });
  }
}

function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    'Location': '/posts'
  });
  res.end();
}

module.exports = {
  handle: handle
};
