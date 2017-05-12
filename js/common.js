var log = console.log.bind(console);

/**
 * 文字変換の静的メソッド群
 * @param str {string} 変換を受ける文字列
 */

/** 文字列の変換に関するクラス */
class Convert
{
  /**
   * 記号を半角変換
   * @param str {string} チェックする文字列
   * @param reg {string} 記号にマッチする文字コード範囲の正規表現
   */
  static mark(str, reg = '[！-｝]') {
    new RegExp(reg, 'g');
    return str.replace(reg, function(_char) {
      Convert.log.add(_char);
      return String.fromCharCode(_char.charCodeAt(0) - 0xFEE0);
    });
  }

  //丸数字を数字に変換
  static encircled(str) {
    return str.replace(/[①-⑳]/g, function(_char) {
      Convert.log.add(_char);
      return '(' + (_char.charCodeAt(0)-9311) + ')';
    })
    .replace(/[㉑-㉟]/g, function(_char) {
      Convert.log.add(_char);
      return '(' + (_char.charCodeAt(0)-12860) + ')';
    })
    .replace(/[㊱-㊿]/g, function(_char) {
      Convert.log.add(_char);
      return '(' + (_char.charCodeAt(0)-12941) + ')';
    });
  }

  //英数を半角に
  static alphanumeric(str, reg = '[Ａ-Ｚａ-ｚ０-９]') {
    str = str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(_char) {
      Convert.log.add('全角英数');
      return String.fromCharCode(_char.charCodeAt(0) - 65248);
    });
    return str;
  }
  //曜日を着色
  static dayColor(str, team = 'a') {
    if (team == 'a') {
      str = str
      .replace(/\(日\)/g, '(<span class="web-text-red">日</span>)')
      .replace(/\(土\)/g, '(<span class="web-tBlue01">土</span>)')
      .replace(/\((.)・祝\)/g, '(<span class="web-text-red">$1・祝</span>)')
      //曜日着色の例外(リンクと見出し)
      .replace(/<p><a class="web-linkMore(.*?)"><span>(.*?)\(<span class="web-t(Red|Blue)01">(.{1,3})<\/span>\)/g, '<p><a class="web-linkMore$1"><span>$2($4)')
      .replace(/<h(\d)(.*?)\(<span class="web-t(Red|Blue)01">(.{1,3})<\/span>\)(.*?)<\/h\d>/g, '<h$1$2($4)$5</h$1>');
    }
    return str;
  }
  //空白行(タブのみ)を削除 this.before.value = Convert.removeEmptyLine(this.before.value);
  static removeEmptyLine(str) {
    return str.replace(/\n\t*(?=\n)/g, '');
  }

  /**
   * デバイス共通文章校正(英数記号の半角化、エスケープ、行末のスペースを削除、時間表記)
   * @param str {string} 対象となる文字列
   * @param teamId {string} チーム種別 [l]チームA [m]チームB
   * @param option オプション [ignoreTab]tab文字をそのままにする [ignoreTime]
   */
  static proof(str, teamId, option) {
    let dates = [];
    this.str = this.alphanumeric(str);
    this.teamId = teamId;
    this.mapReg = new Map([
      [new RegExp('[&＆](?!([a-z]{2,6}|#x?[\\da-zA-Z]{2,4});)', 'g'), '&amp;'],
      [new RegExp('[ 　]+\\n', 'g'), '\n'],
      [new RegExp('(\\d{1,2})：(\\d{2})', 'g'), '$1:$2'],
    ]);

    for (let [_reg, _result] of this.mapReg) {
      this.str = this.str.replace(_reg, function() {
        let _regGroups = Module.cloneAssoc(arguments);
        arguments[0] = arguments[0].replace(/\n/g, '&crarr;');
        Convert.log.add(arguments[0]);
        return _result.replace(/\$(\d+)/g, function(_all, _groupId) {
          return _regGroups[_groupId];
        });
      });
    }

    /*this.str = str
      .replace(/[&＆](?!([a-z]{2,6}|#x?[\da-zA-Z]{2,4});)/g, '&amp;')
      .replace(/[ 　]+\n/g, '\n')
      .replace(/(\d)：(\d{2})/g, '$1:$2');*/
    if(!option === 'ignoreTab') {
      this.str = str.replace(/\t+\n/g, '\n');
    }

    //球団毎の校正
    if (typeof settings === 'object') {
      if (this.teamId === 'a') {
        this.str = this.encircled(this.str);
        this.str = this.run(settings.proofingMapTeamA, true);
      }
      if (this.teamId === 'b') {
        this.str = this.run(settings.proofingMapTeamB, true);
      }
    }
    this.str = this.run(settings.proofingMapCommon, true);

    //タグの閉じ忘れチェック
    let countStart, countEnd;
    for (let tag of settings.checkTags) {
      countStart = (this.str.match(new RegExp('<' + tag, 'g')) || []).length;
      countEnd = (this.str.match(new RegExp('<\\/' + tag, 'g')) || []).length;
      if (countStart > countEnd) {
        Convert.log.add('[?] ' + tag + ' タグ閉じ忘れ');
      } else if (countStart < countEnd) {
        Convert.log.add('[?] ' + tag + ' タグ閉じすぎ');
      }
    }
    if (this.str.match(/href\="https?:\/\/(www|sp|mobile)\.(domain-a|domain-b)\.jp\/(?!special\/)/)) {
      Convert.log.add('[?] 内部リンクが絶対パス');
    }

    //曜日の確認
    dates = (this.str.match(/\d{1,2}月\d{1,2}日\((?:<span class="web-text-red">)?\S(?:・祝)?(?:<\/span>)?\)/g) || []);
    for (let date of dates) {
      let [_all, m, d, day] = date.match(/(\d{1,2})月(\d{1,2})日\((?:<span class="web-text-red">)?(\S)(?:・祝)?(?:<\/span>)?\)/);
      this.checkDay(m, d, day)
    }

    this.check();
    return this.str;
  }

  static check() {
    for (let style in settings.checkStyle) {
      if (!settings.checkStyle[style].teamId || style.teamId === this.teamId) {
        let problem = this.str.match(settings.checkStyle[style].reg);
        if (problem) {
          Convert.log.add('[?] ' + style + ' (' + problem + ')');
        }
      }
    }
  }

  /**
   * 曜日のチェック proofと内容重複
   * @param m {number} 月(普通の数字 -1して使用する)
   * @param d {number} 日
   * @param day {string} チェックする曜日
   * @param y {number} 年(省略でsettingsを使用)
   * @return {bool} 正しい曜日かどうか
   */
  static checkDay(m, d, day, y = settings.thisyear) {
    day = day.replace(/・.*$/, '');
    let dateTarget = new Date(y, m-1, d);
    let correctDay = ['日','月','火','水','木','金','土'][dateTarget.getDay()];
    if (day !== correctDay) {
      Convert.log.add('[?] ' + y + '/' + m + '/' + d + 'は' + correctDay + '曜日');
      return false;
    }
    return true;
  }
  //カタカナを半角に
  static hankaku(str) {
    this.str = str;
    this.map = {
      ' />': ">",
      'ガ': 'ｶﾞ', 'ギ': 'ｷﾞ', 'グ': 'ｸﾞ', 'ゲ': 'ｹﾞ', 'ゴ': 'ｺﾞ',
      'ザ': 'ｻﾞ', 'ジ': 'ｼﾞ', 'ズ': 'ｽﾞ', 'ゼ': 'ｾﾞ', 'ゾ': 'ｿﾞ',
      'ダ': 'ﾀﾞ', 'ヂ': 'ﾁﾞ', 'ヅ': 'ﾂﾞ', 'デ': 'ﾃﾞ', 'ド': 'ﾄﾞ',
      'バ': 'ﾊﾞ', 'ビ': 'ﾋﾞ', 'ブ': 'ﾌﾞ', 'ベ': 'ﾍﾞ', 'ボ': 'ﾎﾞ',
      'パ': 'ﾊﾟ', 'ピ': 'ﾋﾟ', 'プ': 'ﾌﾟ', 'ペ': 'ﾍﾟ', 'ポ': 'ﾎﾟ',
      'ヴ': 'ｳﾞ', 'ヷ': 'ﾜﾞ', 'ヺ': 'ｦﾞ',
      'ア': 'ｱ', 'イ': 'ｲ', 'ウ': 'ｳ', 'エ': 'ｴ', 'オ': 'ｵ',
      'カ': 'ｶ', 'キ': 'ｷ', 'ク': 'ｸ', 'ケ': 'ｹ', 'コ': 'ｺ',
      'サ': 'ｻ', 'シ': 'ｼ', 'ス': 'ｽ', 'セ': 'ｾ', 'ソ': 'ｿ',
      'タ': 'ﾀ', 'チ': 'ﾁ', 'ツ': 'ﾂ', 'テ': 'ﾃ', 'ト': 'ﾄ',
      'ナ': 'ﾅ', 'ニ': 'ﾆ', 'ヌ': 'ﾇ', 'ネ': 'ﾈ', 'ノ': 'ﾉ',
      'ハ': 'ﾊ', 'ヒ': 'ﾋ', 'フ': 'ﾌ', 'ヘ': 'ﾍ', 'ホ': 'ﾎ',
      'マ': 'ﾏ', 'ミ': 'ﾐ', 'ム': 'ﾑ', 'メ': 'ﾒ', 'モ': 'ﾓ',
      'ヤ': 'ﾔ', 'ユ': 'ﾕ', 'ヨ': 'ﾖ',
      'ラ': 'ﾗ', 'リ': 'ﾘ', 'ル': 'ﾙ', 'レ': 'ﾚ', 'ロ': 'ﾛ',
      'ワ': 'ﾜ', 'ヲ': 'ｦ', 'ン': 'ﾝ',
      'ァ': 'ｧ', 'ィ': 'ｨ', 'ゥ': 'ｩ', 'ェ': 'ｪ', 'ォ': 'ｫ',
      'ッ': 'ｯ', 'ャ': 'ｬ', 'ュ': 'ｭ', 'ョ': 'ｮ',
      '。': '｡', '、': '､', 'ー': 'ｰ', '「': '｢', '」': '｣', '・': '･',
      '（': '(', '）': ')',
    };
    return this.run(this.map);
  }

  //カタカナを全角に
  static zenkaku(str) {
    this.str = str;
    this.map = {
      'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
      'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
      'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
      'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
      'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
      'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
      'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
      'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
      'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
      'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
      'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
      'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
      'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
      'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
      'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
      'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
      'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
      'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
      '｡': '。', '､': '、', 'ｰ': 'ー', '｢': '「', '｣': '」', '･': '・'
    };
    return this.run(this.map, 'ｶﾀｶﾅ');
  }

  static dateFormat(str) {
    return str.replace(/(^|[^\d])([1-9]|1[12])\/([1-9]|[12][0-9]|3[01])\(/g, '$1$2月$3日(');
  }

  static lineCompress(str) {
    return str
      .replace(/<\/a><br><br>(\n|)&gt;&gt;<a/g, '</a><br>\n&gt;&gt;<a')
      .replace(/<\/div>(\n|)(<br>(\n|))+<br>/g, '</div>\n<br>')
      .replace(/<br>(\n|)(<br>(\n|))+<br>/g, '<br>\n<br>');
  }

  /**
   * 対応表による文字の置換
   * @param map キーを対象文字、要素を置換後とした連想配列
   * @param setLog replaceLogに記入するかどうか。
   *     true: 記録を取る false:記録を取らない(default) {string}:文字列を記録
   */
  static run(map, setLog = false) {
    var reg = new RegExp('(' + Object.keys(map).join('|') + ')', 'g');
    return this.mark(this.str).replace(reg, function(_match) {
      if (setLog === true) {
        Convert.log.add(_match);
      } else if (setLog !== false) {
        Convert.log.add(setLog);
      }
      //log(_match + ' → ' + map[_match]);
      return map[_match];
    });
  }

  static escapeControl(str) {
    return str.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  }
  static unescapeControl(str) {
    return str.replace(/&#123;/g, '{').replace(/&#125;/g, '}');
  }

  static capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  static zeroPadding(num) {
    log(('0' + num).slice(-2))
    return ('0' + num).slice(-2);
  }

  /** HTMLタグのエスケープ */
  static htmlSpecialChars(str) {
    if(typeof str !== 'string') {
      return str;
    }
    return str.replace(/&(?!amp;)/g, '&amp;')
    .replace(/['`"<>]/g, (_match) => {
      return {
        "'": '&#x27;',
        '`': '&#x60;',
        '"': '&quot;',
        '<': '&lt;',
        '>': '&gt;',
      }[_match]
    });
  }

  /** 正規表現のエスケープ 特殊記号とHTML閉じタグのエスケープ */
  static regSpecialChars(reg) {
    return reg
    .replace(/[\.\|\(\)\[\]\{\}]/g, '\\$&')
    .replace(/<\/([a-z]{1,12})>/g, '<\\/$1>');;
  }

  /**
   * テンプレートの有効化
   * @param items {string, object} テンプレートファイルから読み込んだプレーンな設定
   */
  static enableTemplate(items, baseIndent) {
    if (typeof items === 'undefined') { console.error('テンプレートは定義されていません'); return; }
    if (typeof items === 'string') {
      let regIndent;
      if (typeof baseIndent === 'number') {
        regIndent = new RegExp('^' + ' '.repeat(baseIndent), 'gm');
      } else {
        regIndent = new RegExp('^' + (items.match(/^\n( +)/)||[null,""]), 'gm');
      }
      log(items);
      return items.replace(/^\s*\n/, '')
      .replace(regIndent, '') //ベースインデントの削除
      //.replace(/^\n/, '') //はじめの改行の削除
      .replace(/\n +$/, '\n'); //最後の行のスペースの削除
    }
    if (typeof items === 'object') {
      Object.keys(items).forEach((_key) => {
        items[_key] = Convert.enableTemplate(items[_key], baseIndent);
      });
      //items.push
    }
    return items;
  }
}

/** textareaを直接操作するクラス */
class Textarea
{
  /**
   * 指定テキストエリア内の文字列を選択して実行するとタグで囲みます。
   * @param target {object} 対象テキストエリア
   * @param tagStart {string} 開始文字
   * @param tagEnd {string} 終了文字(省略で閉じタグか開始文字と同様)
   */
  static addTag(target, tagStart, tagEnd) {
    if(tagEnd === undefined) { tagEnd = tagStart.replace(/<([a-zA-Z]+).*?>/, '<\/$1>') };
    var str = target.value;
    var pos = {};
    pos.start = target.selectionStart;
    pos.end = target.selectionEnd;
    var selected = str.slice(pos.start, pos.end);
    var beforeSelect = str.slice(0, pos.start)
    var afterSelect = str.slice(pos.end);

    if (pos.start != pos.end) {
        target.value = beforeSelect + tagStart + selected + tagEnd + afterSelect;
    } else {
        target.value = beforeSelect + tagStart + tagEnd + afterSelect;
    }
  }

  /**
   * 指定テキストエリア内のタグにキャレットを合わせて実行するとクラスを追加します。
   * @param target {object} 対象テキストエリア
   * @param className {string} 追加するクラス名
   * @param seq {array} 区切り文字(省略可/デフォルトでは['<', '>'])
   */
  static addClass(target, className, sep = ['<', '>']) {
    var str = target.value;
    var pos = {}; //選択位置{number}
    pos.start = target.selectionStart;
    pos.end = target.selectionEnd;
    var rangeSelected = str.slice(pos.start, pos.end);
    var ranges = [str.slice(0, pos.start), str.slice(pos.end)];
    var winScrollTop = document.documentElement.scrollTop;
    var posScrollTop = target.scrollTop;
    var fragments = [];
    var innerIds = [0, 0];
    function exception() {
      log('無効な選択範囲です。');
    }

    if(Module.substrCount(rangeSelected, sep[0]) > 1 || Module.substrCount(rangeSelected, sep[1]) > 1 || rangeSelected.match('\n')) {
      return exception();
    }
    for(var i=0; i < 2; i++) { //i=0が開始文字 i=1が終了文字
      if(rangeSelected.match(sep[i])) { //選択範囲に開始・終了文字を含む場合
        fragments = rangeSelected.split(sep[i]);
        innerIds = [fragments.length-1, 0];
        rangeSelected = fragments[innerIds[i]];
        innerIds.reverse();
        if(i == 0) {
          ranges[i] = ranges[i] + fragments[innerIds[i]];
        } else {
          ranges[i] = fragments[innerIds[i]] + ranges[i];
        }
      } else {
        fragments = ranges[i].split(sep[i]);
        if(fragments.length < 2) { return exception(); }
        innerIds = [fragments.length-1, 0];
        if(i == 0) {
          rangeSelected = fragments[innerIds[i]] + rangeSelected;
        } else {
          rangeSelected = rangeSelected + fragments[innerIds[i]];
        }
        fragments.splice(innerIds[i], 1);
        ranges[i] = fragments.join(sep[i]);
      }
    }
    rangeSelected = sep[0] + rangeSelected + sep[1];

    if(!rangeSelected.match(/<[a-zA-Z].*?>/)) { return exception(); }
    rangeSelected = rangeSelected.replace(/<.*?>/, function(_all){
      var attrClass = _all.match(/class="(.*?)"/);
      if(attrClass) {
        if(!attrClass[1].match(className)) {
          _all = _all.replace(/class="(.*?)"/, 'class="$1 ' + className + '"');
        }
      } else {
        _all = _all.replace(/>/, ' class="' + className + '">');
      }
      return _all;
    });

    rangeSelected = rangeSelected.replace(/<td>/g, '<td class="web-bg-3">');
    target.value = ranges[0] + rangeSelected + ranges[1];
    target.focus();
    target.selectionStart = ranges[0].length;
    target.selectionEnd = ranges[0].length + rangeSelected.length;
    target.scrollTop = posScrollTop;
    document.documentElement.scrollTop = winScrollTop;
  }
}

/**
 * ページ内の要素を操作するクラス
 * before, after, outputFilter, info, outputId, navId = 'navbar'
 */
class ConverterPage
{
//  constructor(before, after, outputFilter, infoArea, outputArea, nav) {
  constructor(args = {}) {
    if (typeof document.conv === 'undefined') { document.conv = {}; }
    if (typeof args.before === 'undefined') {
      if (typeof document.conv.before !== 'undefined' && typeof document.conv.before !== 'undefined' && typeof document.conv.before === 'object') {
        args.before = document.conv.before;
      } else {
        args.before = null;
      }
    }
    if (typeof args.after === 'undefined') {
      if (typeof document.conv.after !== 'undefined' && typeof document.conv.after === 'object') {
        args.after = document.conv.after;
      } else {
        args.after = null;
      }
    }
    this.before = args.before;
    this.after = args.after;

    log(typeof this.before);
    this.outputFilter = args.outputFilter || function(str){return str;};
    this.finishOption = "";
    this.infoArea = args.infoArea || document.getElementById('info');
    this.outputArea = args.outputArea || document.getElementById('output');
    this.nav = args.nav || document.getElementById('navbar');
    this.filename = location.pathname.match(/[^/]+$/i)[0];
    this.disableAfterLog = localStorage['disableAfterLog'] == 'true' ? true : false;
    this.disableAutoCopy = localStorage['disableAutoCopy'] == 'true' ? true : false;
    this.infoMaxLength = 80;
    Convert.log = new Set();
    this.replaceLogArea = document.getElementById('replaceLogArea');

    let _this = this;

    window.addEventListener('DOMContentLoaded', function() {
      if(_this.before){
        _this.before.focus();
      }
      _this.setActiveNav();
      _this.setDropdownHover();
      _this.setRecentEdit();
    });
    this.shortcutKey();

    //説明文の表示設定
    this.procedures = document.getElementsByClassName('procedure');
    this.displayProcedure = document.getElementById('displayProcedure');
    if (!localStorage['hideProcedure']) {
      this.displayProcedure.checked = true;
      this.setProceduresVisible(true);
    }
    this.displayProcedure.addEventListener("change", function() {
      let procedures = document.getElementsByClassName('procedure');
      if (this.checked) {
        _this.setProceduresVisible(true);
      } else {
        _this.setProceduresVisible(false);
      }
    }, false);

  }

  /** 説明文の表示 パフォーマンスのため先に */
  setProceduresVisible(order) {
    if (order === true) {
      Array.from(this.procedures).forEach(function(_procedure) {
        _procedure.classList.add('visible');
      });
      localStorage.removeItem("hideProcedure");
    } else {
      Array.from(this.procedures).forEach(function(_procedure) {
        _procedure.classList.remove('visible');
      });
      localStorage['hideProcedure'] = true;
    }
  }

  // 共通ショートカットキーの設定
  shortcutKey(e) {
    var _this = this;
    document.addEventListener('keydown', function(e) {
      if(e.shiftKey) {
        if(e.keyCode === 13) { //Enter
          var active = document.activeElement;
          if(active == _this.before) {
            convertOrder();
          } else if(active == _this.after) {
            _this.refreshOrder();
          }
          e.preventDefault();
        }
      }
      /*
      if(navigator.userAgent.match(/Mac|PC/)) {
        if(e.keyCode === 83 && e.metaKey) { convertOrder(); }
      } else {
        if(e.keyCode === 83 && e.ctrlKey) { convertOrder(); }
      } //C: 67
      */
    });
  }

  // アクティブなナビゲーションリンクにクラスを追加
  setActiveNav() {
    var child = this.nav.getElementsByTagName('li');
    if(this.filename !== 'c_start.html') {
      localStorage['recentFile'] = this.filename;
    }
    var mapCategoryText = {
      'a': 'TeamA', 'c': 'Common'
    }
    var categoryText = mapCategoryText[this.filename[0]];
    for(var i = 0; i < child.length; i++) {
      var anchor = child[i].getElementsByTagName('a')[0];
      if(anchor) {
        var href = anchor.getAttribute('href').match(/[^/]+$/i)[0];
        if(anchor.classList.contains('dropdown-toggle')) {
          if(anchor.textContent === categoryText) {
            child[i].classList.add('active');
          }
        } else if(href === this.filename){
          child[i].classList.add('active');
        }
      }
    }
  }

  // ドロップダウンをマウスオーバーで開く
  setDropdownHover() {
    this.dropdowns = document.getElementsByClassName('dropdown-toggle');
    Array.prototype.forEach.call(this.dropdowns, function(_a) {
      _a.parentElement.addEventListener('mouseover', function() {
        this.classList.add('open');
      });
      _a.parentElement.addEventListener('mouseout', function() {
        if (window.matchMedia('only screen and (min-width : 768px)').matches) {
          this.classList.remove('open');
        }
      });
    });
  }

  setRecentEdit() {
    if(this.filename === 'b_project.html') { return; }
    if(localStorage[this.filename]) {
       this.after.value = localStorage[this.filename];
    }
  }

  // Informationを表示
  info(_infoMes, _spanClass) {
    var _this = this;
    if(_spanClass) {
      _infoMes = '<span class="' + _spanClass + '">' + _infoMes + '</span>';
    }
    this.infoArea.innerHTML = _infoMes;
    this.infoArea.classList.add('info-appear');
    this.infoFadeout;
    clearTimeout(this.infoFadeout);
    this.infoFadeout = setTimeout(() => {
      this.infoArea.classList.remove('info-appear');
    }, 3400);
  }

  // Informationを表示
/*  info(_infoMes, _spanClass) {
    var _this = this;
    if(_spanClass) {
      _infoMes = '<span class="' + _spanClass + '">' + _infoMes + '</span>';
    }
    this.infoArea.innerHTML = _infoMes;
    this.infoArea.setAttribute('style','visibility: visible; opacity: 1; transition: 0.4s; color: black;');
    this.infoFadeout;
    clearTimeout(this.infoFadeout);
    this.infoFadeout = setTimeout( function() {
      _this.infoArea.setAttribute('style','visibility: hidden; opacity: 0; color: transparent; text-shadow: 0 0 5px royalblue; transition: 1.4s;');
    }, 3400);
  }
  */

  /** 置換のあった文字列をthis.replaceLogに表示する */
  setReplaceLog() {
    let logs = "";
    if (Convert.log.size > 0) {logs = '<h2>自動校正</h2> '}
    for (let _char of Convert.log) {
      if (_char.indexOf('[?] ') < 0) {
        logs += '<span class="label">' + _char + '</span>';
      } else {
        _char = _char.slice(3);
        logs += '<span class="label label-danger"><span class="glyphicon glyphicon-question-sign"></span> ' + _char + '</span>';
      }
    }

    this.replaceLogArea.innerHTML = logs;
  }

  // Convert Prepare
  convertPrepare() {
    Convert.log = new Set();
    this.before.value = this.before.value.replace(/^[ \t\n\r]*/, '').replace(/\s*$/, '');
  }

  // Preview Refresh Button
  refreshOrder() {
    if(this.after.value) {
      this.finish('プレビューを更新してクリップボードにコピーしました。');
    } else {
      this.info('出力エリアに文字列がありません。', 'info-attn');
    }
  }

  /** 簡易プレビューを更新する */
  previewRefresh(str) {
    this.outputArea.children[1].innerHTML = this.outputFilter(str);
    this.outputArea.setAttribute('style','visibility: visible; opacity: 1; transition: 2s;');
    this.after.style.height = this.outputArea.clientHeight + 'px';
  }

  /** 変換後の処理 簡易プレビューを更新し、変換後ソースと校正ログを出力する */
  finish(_infoMes, str = this.after.value) {
    if (!this.disableAutoCopy) { Module.setClipboard(str); }
    if (!this.disableAfterLog) { localStorage[this.filename] = str; }

    // 文章構成をかけなおす
    //Convert.log.clear();

    if (this.finishOption !== 'notProof') { str = Convert.proof(str, (this.teamId || '')); }
    this.after.value = str;
    if (this.replaceLogArea) { this.setReplaceLog(); }
    this.previewRefresh(str);
    this.info(_infoMes);
  }

  // Open All Links
  openAllLinks(className = 'panel-body') {
    this.info('プレビューに表示されているリンクをすべて開きます。');
    var links = (this.outputArea.getElementsByClassName(className)[0] || this.outputArea).querySelectorAll('a');
    log(links);
    links.forEach(function(_link, _winId) {
      _link = _link.getAttribute('href');
      open(_link, 'window' + _winId)
      focus()
    });
  }

  // クリップボードに指定文字列をコピー
  copy(str, infoMes = 'クリップボードに文字列をコピーしました。'){
    if(!str){
      this.info('文字列がありません。', 'info-attn');
      return;
    }
    Module.setClipboard(str);
    if(str.length > this.infoMaxLength) { str = str.substr(0, this.infoMaxLength) + '...'; }
    this.info(infoMes + '<br>\n<div class="bracket">' + Convert.htmlSpecialChars(str) + '</div>');
  }

  /**
   * ニュース更新用のJSONを作成する
   *
   */
  createCode(items = []) {
    let json = {
      title: {
        name: "OpenCmsString.Title_1_.0",
        val: (typeof items.title === 'undefined')? '' : items.title,
      },
      newsDevice: {
        name: "OpenCmsString.Device_1_.0",
        val: true,
        checkbox: (typeof items.newsDevice === 'undefined')? [0, 1, 2] : items.newsDevice,
      },
      date: {
        name: "OpenCmsDateTime.DisplayDate_1_.0",
        val: (typeof items.date === 'undefined')? '2017-01-01' : items.date,
      },
      category: {
        name: "OpenCmsString.Category_1_.0",
        val: "/.content/news/category/nc_"
        + ((typeof items.category === 'undefined')? '' : ('0000000' + items.category).slice(-8))
        + ".html",
      },
      sugotoku: {
        name: "OpenCmsBoolean.DisplayToSugotoku_1_.0",
        val: (typeof items.sugotoku === 'undefined' || items.sugotoku === true)? true : false,
        checkbox: [0],
      },
      topics: {
        name: "OpenCmsBoolean.DisplayTotopics_1_.0",
        val: (typeof items.topics === 'undefined' || items.sugotoku === false)? false : true,
        checkbox: [0],
      },
      device1: {
        name: "OpenCmsString.NewsBody_1_.Choice_1_.Easy_1_.Device_1_.0",
        val: true,
        checkbox: (typeof items.device1 === 'undefined')? [0,1] : items.device1,
      },
      device2: {
        name: "OpenCmsString.NewsBody_1_.Choice_1_.Easy_2_.Device_1_.0",
        val: true,
        checkbox: (typeof items.device2  === 'undefined')? [2] : items.device2,
      },
      body1: {
        name: "OpenCmsString.NewsBody_1_.Choice_1_.Easy_1_.BodyTextUpper_1_.0",
        val: (typeof items.body1  === 'undefined')? '' : items.body1,
      },
      body2: {
        name: "OpenCmsString.NewsBody_1_.Choice_1_.Easy_2_.BodyTextUpper_1_.0",
        val: (typeof items.body2  === 'undefined')? '' : items.body2,
      },
    };
    return JSON.stringify(json);
  }
}


/**
 * PCMUT
 * teamId, before, after, outputFilter, infoId, outputId, navId
 */
class ConverterPagePc extends ConverterPage
{
  constructor(args) {
    super(args);
    //before, after, outputFilter, infoId, outputId, navId
    this.date = args.date || document.conv.date;
    this.date.value = Module.getNow('yyyy-mm-dd');
    var siteDomains = {
      'a': 'a.example.com',
      'b': 'b.example.com',
    };
    this.teamId = args.teamId;
    this.siteDomain = siteDomains[this.teamId];

    //チームAの原稿書式条件定義
    if (this.teamId === 'a') {
      this.config = settings.automarkTeamA.config;
      this.template = Convert.enableTemplate(settings.automarkTeamA.template);
      this.tagRegs = {
        h1: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamA.tags.h1), 'gm'),
        h2: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamA.tags.h2), 'gm'),
        h3: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamA.tags.h3), 'gm'),
        h4: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamA.tags.h4), 'gm'),
        p: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamA.tags.p), 'gm'),
        red: new RegExp(Convert.regSpecialChars(settings.automarkTeamA.tags.red) + '([\\s\\S]*?)' + Convert.regSpecialChars(settings.automarkTeamA.tags.red), 'g'),
        bold: new RegExp(Convert.regSpecialChars(settings.automarkTeamA.tags.bold) + '([\\s\\S]*?)' + Convert.regSpecialChars(settings.automarkTeamA.tags.bold), 'g'),
        imgCap: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamA.tags.img) + '\\s+' + Convert.regSpecialChars(settings.automarkTeamA.tags.figcaption) + '(.*?)', 'gm'),
        img: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamA.tags.img), 'gm'),
        table: new RegExp('(.*?\\t.*?\\n[\\s\\S]*?)\\n(?:' + Convert.regSpecialChars(settings.automarkTeamA.tags.table) + '[ 　]?(.*))?(?={h[123]|\\n\\n)', 'g'),
        //[表]
        tableCol: new RegExp('(\\d{1,2})' + settings.automarkTeamA.tags.tableCol),
        tableThead: new RegExp(settings.automarkTeamA.tags.tableThead + '[ 　]?(\\d{1,2})'),
        tableTh: new RegExp(settings.automarkTeamA.tags.tableTh + '[ 　]?(\\d{1,2})'),
        tableThDevide: new RegExp('\\n' + Convert.regSpecialChars(settings.automarkTeamA.tags.tableThDevide) + '([\\s\\S]*)'),
      }
      //log(this.tagRegs);
    }

    //チームBの原稿書式条件定義
    if (this.teamId === 'b') {
      this.config = settings.automarkTeamB.config;
      this.template = Convert.enableTemplate(settings.automarkTeamB.template);
      this.tagRegs = {
        ignoreTab: new RegExp('^' + '(' + Convert.regSpecialChars(settings.automarkTeamA.tags.h2) + '|' + Convert.regSpecialChars(settings.automarkTeamA.tags.h3) + '|' + Convert.regSpecialChars(settings.automarkTeamA.tags.h4) + '|' + Convert.regSpecialChars(settings.automarkTeamA.tags.h5) + '|※|・)\\t', 'gm'),
        h1: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamB.tags.h1), 'gm'),
        h2: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamB.tags.h2), 'gm'),
        h3: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamB.tags.h3), 'gm'),
        h4: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamB.tags.h4), 'gm'),
        h5: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamB.tags.h5), 'gm'),
        p: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamB.tags.p), 'gm'),
        red: new RegExp(Convert.regSpecialChars(settings.automarkTeamB.tags.red) + '([\\s\\S]*?)' + Convert.regSpecialChars(settings.automarkTeamB.tags.red), 'g'),
        bold: new RegExp(Convert.regSpecialChars(settings.automarkTeamB.tags.bold) + '([\\s\\S]*?)' + Convert.regSpecialChars(settings.automarkTeamB.tags.bold), 'g'),
        imgCap: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamB.tags.img) + '.*?\\s+' + Convert.regSpecialChars(settings.automarkTeamB.tags.figcaption) + '(.*?)', 'gm'),
        img: new RegExp('^' + Convert.regSpecialChars(settings.automarkTeamB.tags.img), 'gm'),
        table: new RegExp('(.*?\\t.*?\\n[\\s\\S]*?)\\n(?:' + Convert.regSpecialChars(settings.automarkTeamB.tags.table) + '[ 　]?(.*))?(?=\\{h[123]|\\n)', 'g'),
        //[表]
        tableCol: new RegExp('(\\d{1,2})' + settings.automarkTeamB.tags.tableCol),
        tableThead: new RegExp(settings.automarkTeamB.tags.tableThead + '[ 　]?(\\d{1,2})'),
        tableTh: new RegExp(settings.automarkTeamB.tags.tableTh + '[ 　]?(\\d{1,2})'),
        tableThDevide: new RegExp('\\n' + Convert.regSpecialChars(settings.automarkTeamB.tags.tableThDevide) + '([\\s\\S]*)'),
      }
      log(this.tagRegs);
    }
  }

  //球団共通 PCMUT Convert Process
  convertProcess(str) {
    str += '\n\n';
    if (str.match(/{h1}(.*?)\n/) && this.team === 'a') {
      document.conv.eventMode.checked = true;
    }

    var eventMode = (document.conv.eventMode || document).checked,
      autoParagraph = (document.conv.autoParagraph || document).checked,
      parBreak = document.conv.parBreak.checked,
      disableMarkdown = document.conv.disableMarkdown.checked,
      imgCount = 1, imgSource,
      imgName = document.conv.imgName.value,
      date = document.conv.date.value.replace(/-/g, ''),
      datedir = document.conv.date.value.replace(/-/g, '/').slice(2),
      yyyy = date.substr(0,4),
      yymmdd = date.substr(2,6);
    if (!imgName) {imgName = 'image';}

    var goodsMode = (typeof document.conv.excelParse !== 'undefined' && document.conv.excelParse.checked)? true : false;

    settings.automark = {
      tableHeader: `<table class="web-table01 web-js-table-wrap">`,
    }

    //チームB グッズニュースモードのみ
    if (goodsMode) {
      str = str
      .replace(/］/g, ']')
      .replace(/［/g, '[')
      .replace(/^\t*ニュース名.*\n\t*アップ希望日.*\n/, '')
      .replace(/((?:.*?\t){8}).+/gm, '$1')
      .replace(/^\t*(.*?)\t*$/gm, '$1')
      .replace(/\n"([\s\S]*?)"([\n\t])/g, (_all, _cell, _after) => {
        _cell = _cell.replace(/\n{2,}/g, '\n');
        return '\n' + _cell.replace(/\n/g, '') + _after;
      })
      .replace(/\t"([\s\S]*?)"([\n\t])/g, (_all, _cell, _after) => {
        _cell = _cell.replace(/\n{2,}/g, '\n');
        return '\t' + _cell.replace(/\n/g, '\n') + _after;
      })
      .replace(new RegExp('(' + Convert.regSpecialChars(settings.automarkTeamB.tags.img) + '.[^\\t\\n]*)\n', 'g'), '$1\n\n')
      .replace(/\t{2,}/g, '\t')
      .replace(/\n[ 　/t](\n|$)/g, '\n$1');

      str = str.replace(new RegExp('\t(?=' + Convert.regSpecialChars(settings.automarkTeamB.tags.img) + ')', 'g'), '\n')
    }

    //両球団の原稿書式変換 (this.template)
    if (!disableMarkdown) {
      str = str
      .replace(this.tagRegs.ignoreTab, '$1')
      .replace(/^[\s\S]*/, (_all)=> {log(_all); return _all;})
      .replace(this.tagRegs.h2, '\n$&')
      .replace(this.tagRegs.h3, '\n$&')
      .replace(this.tagRegs.table, (_all, _table, _params = "") => {
        let theadRow = parseInt((this.tagRegs.tableThead.exec(_params) || [])[1] || this.config.tableTheadDefault, 10);
        let thCol = parseInt((this.tagRegs.tableTh.exec(_params) || [])[1] || this.config.tableThDefault, 10);
        _table = _table.replace(/\s*$/, '\n');

        /** tableタグ内 */
        let table = [[]]; //最初の行の初期化
        /** 現在のテーブル行番号 */
        let rowId = 0;

        /** 改行で区切った原稿 */
        let cells = _table.split('\t');
        /** HTMLソース内のインデント数 */
        let baseIndent = '';
        /** tableの最大列数 */
        let colMax = 0;
        /** 現在の列数 */
        let colId = 0;
        /** 表オプションでの列数指定の有無 */
        let hasColMaxSet = false;

        console.table(cells);

        let _param = (this.tagRegs.tableCol.exec(_params) || [])[1] || null;
        if (_param !== null) {
          colMax = parseInt(_param, 10);
          hasColMaxSet = true;
        } else {
          //指定がない場合にはタブ・改行区切りで一番多い列数を探す
          let _nowCount = 0; //列数のカウント
          _table.split('\n').forEach((_row) => {
            _nowCount = _row.split('\t').length;
            if (_nowCount > colMax) { colMax = _nowCount; }
          });
        }

        //タブ区切りで回す
        let _lastCells = []; //最後のセルを改行区切りで持つ
        cells.forEach((cell, cellId) => {
          if (colId >= colMax - 1) {
          //行末セルの処理 分割して2セル分格納する
            cell = cell.replace(this.tagRegs.tableThDevide, (_all, _cell) => {
              //行頭に区切り文字で最初の行を改行
              return '\n' + _cell.replace(/\n/g, '<br>');
            });
            _lastCells = cell.split('\n');
            log(_lastCells);
            if (typeof cells[cellId + 1] !== 'undefined') {
            //次のセルがありそうなら最後のタブ区切りを次の初列目に設定して削除
              table[rowId + 1] = [];
              table[rowId + 1][0] = _lastCells[_lastCells.length - 1];
              _lastCells.pop();
              if (typeof _lastCells === 'string') { _lastCells = [_lastCells]; }
              table[rowId][colId] = _lastCells.join('<br>\n').replace(/<br>\s+$/, '');
              colId = 1;
              rowId++;
              //console.table(table);
            } else {
              //最終セル
              table[rowId][colId] = _lastCells.join('<br>\n').replace(/<br>\s+$/, '');
            }
          } else {
          //普通のセル
            table[rowId][colId] = cell.replace(/\n/g, '<br>\n').replace(/<br>\s+$/, '');
            colId++;
          }
        });
        //console.table(table);

        if (colMax === 2 && hasColMaxSet === false) {
          //dlソースの作成
          log('{dl}' + _table.replace(/\t(?!\n)/g, '\t\n') + '{/dl}');
          return '{dl}' + _table.replace(/\t(?!\n)/g, '\t\n') + '{/dl}';
        } else {
          //tableソースの作成
          let tableSrc = this.template.tableHeader + '\n';
          tableSrc += '  <colgroup>';
          for (let i = 0; i < colMax; i++) {
            tableSrc += '<col>';
          }
          tableSrc += '</colgroup>\n';

          //行数ループ
          let cellTags = this.template.tableThead;
          table.forEach((row, rowId) => {
            if (rowId < theadRow) {
              tableSrc += '  <thead>\n';
            } else if (rowId === theadRow) {
              if (theadRow !== 0) {
                tableSrc += '  </thead>\n  <tbody>\n'
              } else {
                tableSrc += '  <tbody>\n'
              }
            }
            tableSrc += '    <tr>\n';
            log(row);
            row.forEach((cell, colId) => {
              //タグの指定 (theadの場合は未指定でよい)
              if (rowId >= theadRow) {
                if (colId < thCol) { cellTags = this.template.tableTh; }
                else { cellTags = this.template.tableTd; }
              }

              tableSrc += '      ' + cellTags[0] + cell + cellTags[1] + '\n';
            });
            tableSrc += '    </tr>\n';
          });

          tableSrc += baseIndent + '  </tbody>\n';
          tableSrc += baseIndent + this.template.tableFooter;
          return tableSrc;
        }
      })
      .replace(this.tagRegs.h1, '{h1}')
      .replace(this.tagRegs.h2, '{h2}')
      .replace(this.tagRegs.h3, '{h3}')
      .replace(this.tagRegs.h4, '{h4}')
      .replace(this.tagRegs.h5, '{h5}')
      .replace(this.tagRegs.p, '{p}')
      .replace(this.tagRegs.red, '{red}$1{/red}')
      .replace(this.tagRegs.bold, '{b}$1{/b}')
      .replace(this.tagRegs.imgCap, '{img cap}$1')
      .replace(this.tagRegs.img, '{img}')
      .replace(/^[>＞]{2}(.*?)\n(https?\:\/\/.*?)\n/gm, '{a $2 btn}$1\n')
      .replace(/^[>＞](.*?)\n(https?\:\/\/.*?)\n/gm, '{a $2}$1\n')
      .replace(/^[>＞]{2}(.*?)\n(https?\:\/\/.*?)\n/gm, '{a $2 btn}$1\n')
      .replace(/^[>＞](.*?)\n(https?\:\/\/.*?)\n/gm, '{a $2}$1\n')
      .replace(/(\n\{h3\}(.*)\n[\s\S]*?){goods (1?\d)}/g, (_all, _before, _title, _count) => {
        log(("{img}" + _title + '\n').repeat(parseInt(_count, 10)));
        return _before + ("{img}" + _title + '\n').repeat(parseInt(_count, 10));
      })
      //.replace(/^[\s\S]*$/, (_all) => {log(_all); return _all;})
      ;
    }

    /** imgタグに付加するオプション (チームBグッズ原稿モードのみ幅を固定) */
    var imgTagOption = '';
    if (goodsMode) {
      imgTagOption = ' width="360"';
    }

    str = str
    .replace(/(d{1,2})：(\d{2})/g, '$1:$2')
    .replace(/[\s\S]*(【本文】|\{h3\}本文)\n?/, '')
    .replace(/^"/g, '')
    .replace(/"$/g, '\n')
    .replace(/^※(.*?)\n/gm, '<ul class="web-list-memo-02">\n  <li><span class="web-list-mark01">※</span>$1</li>\n</ul>\n')
    .replace(/^・(.*?)\n/gm, '<ul class="web-list-memo-02">\n  <li><span class="web-list-mark01">・</span>$1</li>\n</ul>\n')
    .replace(/<\/ul>\n*<ul class="web-list-memo-02">\n/g, '')

    //リンクの生成
    .replace(new RegExp('\/\/(preview\.)?(?:www|sp|mobie).' + this.siteDomain, 'g'), '//www.' + this.siteDomain)
    .replace(new RegExp('\{a https?:\/\/www.' + this.siteDomain + '(.*?) btn\}(.*?)\n', 'g'), '<p class="web-btn-container"><a class="web-btn-4" href="$1"><span>$2</span></a></p>\n')
    .replace(/\{a http(s?:\/\/.*?) btn\}(.*?)\n/g, '<p class="web-btn-container"><a class="web-btn-4 web-iconNewWindow02" href="http$1" target="_blank"><span>$2</span></a></p>\n')
    .replace(new RegExp('\{a https?:\/\/www.' + this.siteDomain + '(.*?)\}(.*?)\n', 'g'), '<p><a class="web-link-3" href="$1"><span>$2</span></a></p>\n')
    .replace(/\{a http(s?:\/\/.*?)\}(.*?)\n/g, '<p><a class="web-link-3 web-out01" href="http$1" target="_blank"><span>$2</span></a></p>\n')

    //見出し
    .replace(/<div class="web-containerBA web-container-AB">\{h1\}(.*?)\n/g, '<div class="web-titleWrap05"><h1>$1</h1></div>\n<div class="web-containerBA web-container-AB">\n')
    .replace(/\{h2\}(.*?)\n/g, '</div>\n<h2 class="web-h2"><span class="web-titleInner">$1</span></h2>\n<div class="web-containerBA web-container-AB">\n')
    .replace(/\{h3\}(.*?)\n/g, '</div>\n<h3 class="web-h3Title02"><span class="web-titleInner">$1</span></h3>\n<div class="web-containerBA web-container-AB">\n')
    .replace(/\{h4\}(.*?)\n/g, '<h4 class="web-h4Title02"><span class="web-titleInner">$1</span></h4>\n')
    .replace(/\{h5\}(.*?)\n/g, '<p class="web-text-bold">$1</p>\n')

    //画像
    .replace(/((\{img(?: cap)?\}(.*?)\n){2,})/g, '  <div class="web-containerB">\n$1  </div>\n')
    .replace(/web-containerB(">\s*?(\{img(?: cap)?\}.*?\n){3}\s*?<\/div>)/g, '  web-boxColumn3$1')
    .replace(/\{img( cap)?\}(.*?)?\n/g, function(_all, _caption, _alt) {
      if (!eventMode) {
        var src = '/images/' + datedir + '/xh_' + imgName + ('0' + imgCount).slice(-2) + '.jpg';
      } else {
        var src = '/images/' + imgName + '/' + yyyy + '/xh_' + yymmdd + '_' + ('0' + imgCount).slice(-2) + '.jpg';
      }
      imgCount++;
      if (goodsMode) {
        _alt = 'グッズ写真';
      }
      if (!_alt) {var _alt = "";}
      imgSource = '    <div class="web-image-container01">\n      <figure>\n        <img src="' + src + '" alt="' + _alt + '"' + imgTagOption + '>\n';
      if (_caption === ' cap') {
        imgSource += '        <figcaption class="web-text-center">'
        + _alt
        + '</figcaption>\n'
      }
      imgSource += '      </figure>\n    </div>\n';
      return imgSource;
    });

    str = str
    //文章段落 (まず改行が足りない場合には2回の改行に増やす)
    .replace(/(^\{p\}[\s\S]*?\n)([<\{])/gm, '$1\n$2')
    //.replace(/[\s\S]*/, function (_all) { log(_all); return _all; })
    .replace(/^\{p\}([\s\S]*?)\n+(?=\s+[<\n]|\{|$)/gm, function(_all, _text) {
      if (parBreak) {
        _text = _text.replace(/\n(?=.)/g, '<br>\n    ');
      } else {
        _text = _text.replace(/\n(?=.)/g, '\n    ');
      }
      return '  <div class="web-text-block">\n    <p>' + _text + '</p>\n  </div>\n';
    })
    .replace(/<\/p>\s*<\/div>\s*<div class="web-text-block">\s*<p>/g, '</p>\n    <p>')

    //文字装飾
    .replace(/\{red\}([\s\S]*?)\{\/red\}/g, '<span class="web-text-red">$1</span>')
    .replace(/\{b\}([\s\S]*?)\{\/b\}/g, '<span class="web-text-bold">$1</span>')
    .replace(/<li><span class="web-list-mark01">※<\/span><span class="web-text-red">(.*?)<\/span><\/li>/g, '<li class="web-text-red"><span class="web-list-mark01">※</span>$1</li>')
    .replace(/<li><span class="web-list-mark01">※<\/span><span class="web-text-bold">(.*?)<\/span><\/li>/g, '<li class="web-text-bold"><span class="web-list-mark01">※</span>$1</li>')
    .replace(/<p><span class="web-text-red">([\s\S]*?)<\/span><\/p>/g, '<p class="web-text-red">$1</p>')
    .replace(/<p><span class="web-text-bold">([\s\S]*?)<\/span><\/p>/g, '<p class="web-text-bold">$1</p>')

    //DL
    .replace(/\{dl\}([\s\S]*?\{\/dl\})\n/g, function(_all, source) {
      source = source.replace(/([^\n])\{\/dl\}$/, '$1\n{/dl}'); //最終行で改行を強制
      if (source.indexOf('\t') < 0) {
        source = source.replace(/\|/g, '\t');
      }
      source = source.replace(/\t\n+/g, '\t');
      for (var tabCount = (source.match(/\t/g)||[]).length;  tabCount > 0 ; tabCount--) {
        source = source.replace(/(.*?)\t([\s\S]*?)\n(.*?(?:\t|\{\/dl\}))/, function(dlSource, _dt, _dd, _next) {
          if (_dd.indexOf('\n') >= 0) {
            _dd = _dd.replace(/\s+$/, '');
            _dd = '\n      ' + _dd.replace(/\n/g, '<br>\n      ').replace(/(>)<br>/g, '$1') + '\n    ';
          }
          return '  <dl>\n    <dt>' + _dt + '</dt>\n    <dd>' + _dd + '</dd>\n  </dl>\n' + _next;
        });
      }
      return '<div class="web-dl-wrap">\n' + source.replace('{/dl}','') + '</div>\n';
    });

    if (autoParagraph) {
      //なにも変換されなかったものを文章段落に変換
      str = str.replace(/^([^<  \n][^\n]+?)\n+/gm, (_all, _text) => {
        if (parBreak) {
          _text = _text.replace(/\n(?=.)/g, '<br>\n    ');
        } else {
          _text = _text.replace(/\n(?=.)/g, '\n    ');
        }
        return '  <div class="web-text-block">\n    <p>' + _text + '</p>\n  </div>\n';
      })
      .replace(/<\/p>\s*<\/div>\s*<div class="web-text-block">\s*<p>/g, '</p>\n    <p>');
    }

    //余分な改行・タグの削除
    str = str.replace(/\n{3,}/g, '\n\n')
    .replace(/<div class="web-containerBA web-container-AB">\n<\/div>\n/, '');

    //チームA: 曜日の着色
    if (this.teamId === 'a') {
      str = str.replace(/[♡♥]/g, '<img src="/images/_heart01.gif">');
      str = Convert.dayColor(str, 'a');
    }

    return str;
  };

}

class ConverterPageFp extends ConverterPage
{
  constructor(args) {
    super(args);
    var siteDomains = {
      'a': 'a.example.com',
      'b': 'b.example.com',
    };
    this.teamId = args.teamId;
    this.siteDomain = siteDomains[args.teamId];
  }

  //Add Picture
  addPicture() {
    var str  = this.after.value;
    var imgFirst = str.match(new RegExp('<img src="\/fp\/img\/dummy.gif" alt="- "><a href="\/fitter\/' + this.teamId + '\/(.*?)"(.*?)>'));
    if(imgFirst) {
      if (!imgFirst[1].match('limit=')) { imgFirst[1] += '&amp;limit=30p'; }
      str = '<img src="/fitter/' + this.teamId + '/' + imgFirst[1] + '"><br>\n<br>\n' + str;
      this.finish('画像タグを追加してクリップボードにコピーしました。', str);
      this.after.value = str;
    } else {
      this.info('画像リンクが一つ以上必要です。', 'info-attn');
    }
  }

  //FP変換 球団共通 Convert Process
  convertProcess(str) {
    var _this = this;
    var mapRp = {
      '</div>': "",
      '</section>': "",
      '</p>': '<br><br>',
      '<dl>': "", '<\/dl>': '<br>',
      '<dt>': '<div class="hd_04">',
      '</dt>': '</div>', '<dd>': "", '</dd>': '<br>',
      '<img src="/images/_heart01.gif">': '<img src="/fp/img/59116.gif">',
      '<span class="web-tBlue01">土</span>': '<span class="day02">土</span>',
      '<span class="web-text-red">日</span>': '<span class="day01">日</span>',
      '・<span class="web-text-red">祝</span>': '･<span class="day01">祝</span>',
      '<li><span class="web-list-mark01">※</span>': '<div class="annot01">※',
      '</li>': '</div>',
      '</ul>': '<br>',
    };
    str = Convert.encircled(str);

    if (document.conv.dtStyle.value == 'icon03') {
      mapRp['<dt>'] = '<span class="icon03">■</span>', mapRp['</dt>'] = '<br>';
    } else if (document.conv.dtStyle.value == 'brackets') {
      mapRp['<dt>'] = '[', mapRp['</dt>'] = ']<br>';
    }
    var reg = new RegExp('(' + Object.keys(mapRp).join('|') + ')', 'g');
    return str
    .replace(/<div.*?>/g, '')
    .replace(/<section.*?>/g, '')
    .replace(/\t|  /g, '')
    .replace(/\n /g, '\n')
    .replace(/<iframe(.*?)>(.*)<\/iframe>/g, '')
    //Pattern match
    .replace(reg, function(match) {
      //log(match + ' → ' + mapRp[match]);
      return mapRp[match];
    })
    .replace(/<!--(.*?)-->/g, '')
    .replace(/^[\s\S]*$/, (_all) => {log(_all);return _all;})
    .replace(/<p class="web-text-bold">(.*?)<br>/g, '[$1]') //太字のみ
    .replace(/<p(.*?)>/g, '')
    .replace(/<span class="web-text-red">(.*?)<\/span>/g, '<span class="info">$1</span>')

    //tableの簡易変換
    .replace(/<table(.*?)>[\s\S]*?<\/table>/g, function(_table){
      var _theads = [];
      _table = _table
        .replace(/<colgroup>[\s\S]*?<\/colgroup>/, '')
        .replace(/<thead>([\s\S]*?)<\/thead>/, function(_theadAll) {
          _theadAll.replace(/<th.*?>\n?(.*?)\n?<\/th>/g, function(_thAll, _thInner) {
            _theads.push(_thInner);
          });
          return '';
        })
        .replace(/<tr>([\s\S]*?)<\/tr>/g, function(_trAll, _row) {
          var _rowId = 0;
          _row = _row.replace(/<td.*?>(.*)<\/td>/g, function(_tdTag, _innerText){
            log(_innerText);
            _rowId++;
            return '[' + _theads[_rowId] + ']<br>\n' + _innerText + '<br>\n';
          });
          return _row + '<br>\n';
        });

      if (document.conv.dtStyle.value == 'hd_04') {
        _table = _table.replace(/<th.*?>([\s\S]*?)<\/th>/g, '<div class="hd_04">$1</div>');
      } else {
        _table = _table.replace(/<th.*?>/g, '<span class="icon03">■</span>');
      }

      _table = _table
      .replace(/<(tr|\/?thead|\/?tbody|\/?table).*?>/g, '')
      .replace(/<(\/td|\/th|\/tr)>/g, '<br>');

      return _table;
    })
    .replace(/<col(.*?)>/g, '')
    .replace(/<td(.*?)>/g, '[]')
    .replace(/<ul(.*?)>/g, '')
    .replace(/<li(.*?)>/g, '')
    .replace(/<span class="web-list-mark0\d">･<\/span>(.*?)<\/div>/g, '･$1<br>')
    .replace(/<(\/|)figure(.*?)>/g, '')
    .replace(/<h1>\s*?(.*?)\s*?<\/h1>/g, '<div class="hd_02">$1<hr></div>')
    .replace(/<h2 (.*?)class="web-h2Title(.*?)><span class="web-titleInner">(.*?)<\/span><\/h2>/g, '<br>\n<div class="hd_03">$3</div>')
    .replace(/<h3 (.*?)class="web-h3Title(.*?)><span class="web-titleInner">(.*?)<\/span><\/h3>/g, '<br>\n<div class="hd_04">$3</div>')
    .replace(/<h4 (.*?)class="web-h4Title(.*?)><span class="web-titleInner">(.*?)<\/span><\/h4>/g, '<span class="icon03">■</span>$3<br>')
    //img-figcaption
    .replace(/<img (.*?)src="\/cmn\/images\/news\/(.*?)"(.*?)>(\n|)<figcaption(.*?)>(.*?)<\/figcaption>/g, '<img src="/fp/img/dummy.gif" alt="- "><a href="/fitter/' + this.teamId + '/news/img/$2?cache=no&amp;wp=max">$6</a><br><br>')
    .replace(/<img (.*?)src="\/cmn\/images\/(.*?)"(.*?)>(\n|)<figcaption(.*?)>(.*?)<\/figcaption>/g, '<img src="/fp/img/dummy.gif" alt="- "><a href="/fitter/' + this.teamId + '/$2?cache=no&amp;wp=max">$6</a><br><br>')
    //img-alt
    .replace(/<img(.*?) alt="(.*?)"(.*?)>/g, '<img$1$3 alt="$2">')
    .replace(/<img (.*?)src="\/cmn\/images\/news\/(.*?)" (.*?)alt="(.*?)"(.*?)>/g, '<img src="/fp/img/dummy.gif" alt="- "><a href="/fitter/' + this.teamId + '/news/img/$2?cache=no&amp;wp=max">$4</a><br>')
    .replace(/<img (.*?)src="\/cmn\/images\/(.*?)" (.*?)alt="(.*?)"(.*?)>/g, '<img src="/fp/img/dummy.gif" alt="- "><a href="/fitter/' + this.teamId + '/$2?cache=no&amp;wp=max">$4</a><br><br>')
    //img-ordinary
    .replace(/<img (.*?)src="\/cmn\/images\/news\/(.*?)"(.*?)>/g, '<img src="/fp/img/dummy.gif" alt="- "><a href="/fitter/' + this.teamId + '/news/img/$2?cache=no&amp;wp=max">画像</a><br><br>')
    .replace(/<img (.*?)src="\/cmn\/images\/(.*?)"(.*?)>/g, '<img src="/fp/img/dummy.gif" alt="- "><a href="/fitter/' + this.teamId + '/$2?cache=no&amp;wp=max">画像</a><br><br>')
    .replace(/<a class="web-enlarge01 web-jsModalImg[^>]*>\s*<span>\s*(<img[^>]*><a[^>]*>.*?<\/a>\s*<br>)<\/span>\s*<\/a>/g, '$1')
    //img 重複名
    .replace(/(?:<img src="\/fp\/img\/dummy.gif" alt="\- "><a href="[^"]*?">.*?<\/a><br>\n+){2,}/g, (_all) => {
      let _result = _all;
      let _sameText = "";
      let _imgCount = 0;
      let _cancel = false;
      _result = _result.replace(/<img src="\/fp\/img\/dummy.gif" alt="- "><a href="([^"]*?)">(.*?)<\/a><br>\n+/g, (_img, _href, _text) => {
        _imgCount++;
        //log('imgCount: ' + _imgCount);
        if (_imgCount === 1) {
          _sameText = _text;
          return '<img src="\/fp\/img\/dummy.gif" alt="- ">' + _text + '[<a href="' + _href + '">1</a>';
        } else {
          if (_text === _sameText) {
            return '|<a href="' + _href + '">' + _imgCount + '</a>';
          } else {
            _cancel = true;
            return;
          }
        }
      });
      if (_cancel) { return _all; }
      _result = _result.replace(/\|<a[^>]*>\d<\/a>$/, '$&]<br>\n');
      return _result;
    })

    //リンク
    .replace(/<a .*?href="(.*?)".*?><span>(.*?)<\/span><\/a>/g, function(_all, _href, _text) {
      if (_href.match(/^\/news\/detail\/\d{8}\.html/)) {
        _href = _href.replace(/\/news\/detail\/(\d{8})\.html/, '/news/page.html\?n=$1');
        return '&gt;&gt;<a href="' + _href + '">' + _text + '</a>';
      } else if (_href.match(/^#/)) {
        return '&gt;&gt;<a href="' + _href + '">' + _text + '</a>';
      } else if (_href.match(/^\/(special|local|lfriends|academy)\//)) {
        return '<br>\n' + _text + '<br>\n[URL(PC･ｽﾏｰﾄﾌｫﾝ)]<br>\n<div class="fz_s">https://www.' + _this.siteDomain + _href + '</div>\n<br>';
      } else if (_href.match(/^\//)) {
        return '&gt;&gt;<a href="' + _href + '">' + _text + '</a>';
      } else if (_href.match(/https:\/\/fanclub.a.example.com/)) {
        return '&gt;&gt;<a href="' + _href + '">' + _text + '</a>';
      } else {
        return '<br>\n' + _text + '<br>\n[URL(PC･ｽﾏｰﾄﾌｫﾝ)]<br>\n<div class="fz_s">' + _href + '</div>\n<br>';
      }
    })
    .replace(/<a (.*?)href="\/news\/detail\/(\d{8})\.html"><span>(.*?)<\/span><\/a>/g, '&gt;&gt;<a href="/news/page.html\?n=$2">$3</a>')
    .replace(/<a (.*?)href="\/(.*?)"><span>(.*?)<\/span><\/a>/g, '&gt;&gt;<a href="/$2">$3</a>')
    .replace(/<a (.*?)href="http(.*?)"(.*?)><span>(.*?)<\/span>(\n|)<\/a>/g, '<br>\n$4<br>\n[URL(PC･ｽﾏｰﾄﾌｫﾝ)]<br>\n<div class="fz_s">http$2</div>\n<br>')
    //改行整形
    .replace(/<div class="hd_03">(.*?)<\/div>\n<br>\n<div class="hd_04">/g, '<div class="hd_03">$1<\/div>\n<div class="hd_04">')
    .replace(/\n{2,}/g, '\n')
    .replace(/<br>\s*$/, '')
    .replace(/^\n|\n$/g, '')

    .replace(/<\/a><br><br>\n<img src="\/fp\/img\/dummy.gif" alt="- " \/><a/g, '</a><br>\n<img src="/fp/img/dummy.gif" alt="- "><a')
    ;
  }
}


/**
 * チームBのRESULTS
 * navId, infoId, before, after, afterAlt, afterCol, noticeArea
 */
class ConverterPageFarm extends ConverterPage
{
  constructor(args) {
    super(args);
    this.afterAlt = args.afterAlt || document.conv.afterAlt;
    this.afterCol = args.afterCol || document.conv.afterCol;
    this.noticeArea = args.noticeArea || document.getElementsByClassName('panel-notice')[0];
    this.team0 = settingsTemplate.results.team0;
    this.team1 = settingsTemplate.results.team1;
    this.team2 = settingsTemplate.results.team2;
    this.league = settingsTemplate.results.league;
    this.location = settingsTemplate.results.location;
    this.position = settingsTemplate.results.position;
    this.teamIntrasquad = settingsTemplate.results.teamIntrasquad;
    this.termGameMode = settingsTemplate.results.termGameMode;

    let sameNames = settingsTemplate.results.playerSameNames;
    this.regPlayers = {};
    for (let familyName in sameNames) {
      let _key = familyName;
      if (sameNames[familyName].length === 1) {
        _key += sameNames[familyName];
      } else {
        _key += '[' + sameNames[familyName] + ']';
      }
      this.regPlayers[_key] = new RegExp(familyName + '(?!' + Array.prototype.join.call(sameNames[familyName], '|') + ')', 'g');
    }
    this.regPlayerLong = [];
    for (let familyName in sameNames) {
      for (let i = 0; i < sameNames[familyName].length; i++) {
        this.regPlayerLong.push(familyName + '　' + sameNames[familyName][i]);
      }
    }
    this.regPlayerLong = new RegExp(this.regPlayerLong.join('|'), 'g');

    this.regPosition = new RegExp('(' + Object.keys(settingsTemplate.results.position).join('|') + ')', 'g');
    this.error = [];
  }

  previewRefresh(str) {
    if(this.error.length > 0) {
      let source = "";
      this.error.forEach((_error) => {
        source += _error + '<br>\n';
      });
      this.noticeArea.innerHTML = '<span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span><strong>自動修正</strong><br>\n' + source;
      this.error = [];
      this.noticeArea.classList.remove('hidden');
    } else {
      this.noticeArea.classList.add('hidden');
    }
    super.previewRefresh(str, outputFilter);
    this.afterAlt.style.height = this.outputArea.clientHeight / 3 + 'px';
    this.afterCol.style.height = this.outputArea.clientHeight / 3.5 + 'px';
    this.afterAlt.value = convertProcessFp(str);
    this.afterCol.value = convertProcessCol(this.afterAlt.value);
    this.jsonOrder();
  }

  /** プレイヤー表記を校正する */
  proofPlayer(_arg) {
    for (let _after in this.regPlayers) {
      _arg = _arg.replace(this.regPlayers[_after], (_all) => {
        if (/\[.*?\]/.test(_after)) {
          this.error.push('選手名表記を修正してください。' + '(' + _all + '→' + _after + ')');
        } else {
          this.error.push('選手名表記を修正しました。' + '(' + _all + '→' + _after + ')');
        }
        return _after;
      });
    }
    return _arg;
  }

  /** プレイヤー表記をスタッツ用にする */
  proofPlayerLong(_name, spacer) {
    _name = _name.replace(' ', '　');
    if(!/　/.test(_name) && /^[\u30e0-\u9fcf]+$/.test(_name)){
      this.error.push('スタッツ表の' + _name + 'を姓と名に分けてください。');
    }
    _name = _name
    .replace(this.regPlayerLong, (_all) => {
      Convert.log.add(_all.replace(/(.*?)　(.).*/, '$1$2'));
      return _all.replace(/(.*?)　(.)/, '$1$2　');
    })
    .replace(/　.*$/, '')
    .replace(/^.*・/, '');
    if (_name.length == 2 && spacer) {
      _name = _name.slice(0, 1) + '　' + _name.slice(1);
    }
    return _name;
  }

  /** JSONファイルを書き出す */
  jsonOrder() {
    let newsCatId = '';
    let items = {};
    if (document.conv.gameMode.value === 'intrasquad') {
      newsCatId = 1;
    } else {
      newsCatId = 8;
    }
    items.title = document.getElementById('titlePreview').innerHTML;
    items.opponent = items.title.replace(/.*?vs(.*)/, '$1');

    alert(items.title + '\n' + items.opponent);

    let titleDate;
    if (/1?\d\/\d{1,2}/.test(items.title)) {
      titleDate = items.title.replace(/(1?\d\/\d{1,2}).*/, '$1').split('/');
    } else {
      titleDate = [1, 1];
    }
    let gameDate = new Date(settings.thisyear, parseInt(titleDate[0], 10) - 1, titleDate[1]);

    items.m = gameDate.getMonth() + 1;
    items.d = gameDate.getDate();
    gameDate.setDate(gameDate.getDate() + 1);
    items.column = { m: gameDate.getMonth() + 1, d: gameDate.getDate()}

    let jsonArgs = {
      title: items.title,
      date: settings.thisyear + '/' + items.m + '/' + items.d,
      category: newsCatId,
      body1: tool.after.value,
      body2: tool.afterAlt.value,
    };
    console.table(jsonArgs);
    document.conv.newsCode1.value = tool.createCode(jsonArgs);
    document.getElementById('titlePreview').innerText.replace(/(1?\d)\/\d{1,2}[\s\S]*/, '$1')

    jsonArgs = {
      title: items.column.m + '/' + items.column.d + ' 配信コンテンツ',
      newsDevice: [1, 2],
      date: settings.thisyear + '/' + items.column.m + '/' + items.column.d,
      category: 9,
      device1: [1],
      body1: '<p class=\"web-textBlock\">' + items.column.m + '月' + items.column.d + '日下記のコンテンツを配信しました｡</p>\n<a class=\"web-link-3\" href=\"/column_members/detail/' + settingsTemplate.results.columnThemeId + '/00000000.html\">\n<span>' + items.m + '/' + items.d + '戦評 vs' + items.opponent + '</span>\n</a>',
      body2: items.column.m + '月' + items.column.d + '日下記のｺﾝﾃﾝﾂを配信しました｡<br>\n<br>\n&gt;&gt;<a href=\"/column_members/detail/index.html?c=' + settingsTemplate.results.columnThemeId + '&n=00000000\">\n' + items.m + '/' + items.d + '戦評 vs' + items.opponent + '</a>',
    };
    document.conv.newsCode2.value = this.createCode(jsonArgs);
  }
}

/**
 * CSVDF
 * (before, after, outputFilter, infoId, outputId, navId, date)
 */

class ConverterPageCsv extends ConverterPage
{
  constructor(args) {
    super(args);

    this.baloon = document.getElementById('rollback-baloon');
    this.dropfile = document.getElementById('dropfile');
    this.fontSlider = document.getElementById('fontSlider');
    this.date = document.conv.date;
    this.highlightOnly = document.conv.highlightOnly;
    this.disableProof = document.conv.disableProof;
    this.preformatted = document.conv.preformatted;
    this.carrmark = document.conv.carrmark;
    this.panelBody = document.getElementsByClassName('panel-body')[0];

    this.html = document.documentElement;
    this.body = document.body;

    this.date.value = Module.getNow('yyyy-mm-dd');

    let previewStyle = this.panelBody.style;

    this.tagChanged = { start: ['{c', '}'], end: ['{/c', '}'] };
    this.tagChangedReg = {
      start: new RegExp(this.tagChanged.start[0] + '(\\d+)' + this.tagChanged.start[1], 'g'),
      end: new RegExp(this.tagChanged.end[0] + '(\\d+)' + this.tagChanged.end[1], 'g'),
      all: new RegExp(this.tagChanged.start[0] + '(\\d+)' + this.tagChanged.start[1] + '|' + this.tagChanged.end[0] + '(\\d+)' + this.tagChanged.end[1], 'g')
    };
    this.rollback = [];

    if (localStorage['csvdf.fontsize']) {
      this.fontSlider.value = localStorage['csvdf.fontsize'];
      previewStyle.fontSize = this.fontSlider.value + 'px';
    }

    //ファイルアップロードエリア
    document.getElementById('upfile').addEventListener('change', getFileData, false);
    this.dropfile.addEventListener('dragover', mouseDragover, false);
    this.dropfile.addEventListener('drop', getFileData, false);

    //レンジ: フォント調節
    fontSlider.addEventListener("input", function() {
      previewStyle.fontSize = this.value + 'px';
      localStorage['csvdf.fontsize'] = this.value;
    }, false);

    //チェックボックス (ハイライトのみ)
    if (localStorage['csvdf.highlight']) { this.highlightOnly.checked = true; }
    this.highlightOnly.addEventListener("change", function() {
      if (this.checked) {
        localStorage['csvdf.highlight'] = this.checked;
      } else {
        localStorage.removeItem("csvdf.highlight");
      }
    }, false);
    //チェックボックス (HTML展開しない)
    if (localStorage['df.preformatted']) { this.preformatted.checked = true; }
    this.preformatted.addEventListener("change", function() {
      if (this.checked) {
        localStorage['csvdf.preformatted'] = this.checked;
      } else {
        localStorage.removeItem("csvdf.preformatted");
      }
    }, false);

    if (localStorage['csvdf.disableProof']) { this.disableProof.checked = true; }
    this.disableProof.addEventListener("change", function() {
      if (this.checked) {
        localStorage['csvdf.disableProof'] = this.checked;
      } else {
        localStorage.removeItem("csvdf.disableProof");
      }
    }, false);

    //チェックボックス (改行マークを表示する)
    if (localStorage['csvdf.carrmark']) { this.carrmark.checked = true; }
    this.carrmark.addEventListener("change", function() {
      if (this.checked) {
        localStorage['csvdf.carrmark'] = this.checked;
      } else {
        localStorage.removeItem("csvdf.carrmark");
      }
    }, false);

    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) { super.info('ご利用のブラウザでは File API の機能が一部サポートされていません。'); }

    //直前のCSVの読み込み
    window.addEventListener('DOMContentLoaded', function() {
      if (localStorage['c_csvdf.csv']) { getCsvData(localStorage['c_csvdf.csv'], 'constructor'); }
    }, false);

  }

  //ショートカットキーの上書き
  shortcutKey(e) {
    var _this = this;
    document.addEventListener('keydown', function(e) {
      if(e.shiftKey) {
        if(e.keyCode === 13) { //Enter
          convertOrder();
        }
      }
    });
  }
}

/**
 * CSVDF
 */
class ConverterPageProject extends ConverterPage
{
  constructor(args) {
    super(args);
    this.afterAlt = args.afterAlt || document.conv.afterAlt;
    this.json = [], this.csv = "";
    this.items = [];
    this.itemsCommon = [];
    this.player = {};
    this.date = document.conv.date;
    if (this.date) { this.date.value = Module.getNow('yyyy-mm-dd'); }
    if (typeof settingsParams !== 'undefined') { this.setPlayerNumber(); }
    this.manuscriptId = 0;
    this.recentManuscript = "";
    this.imgCount = 0;

    if (!document.conv.htmlOutputMode) { return; }
    //更新コードかHTMLソースかの選択
    this.htmlOutputMode = document.conv.htmlOutputMode;
    if (localStorage['b_project.htmlOutputMode']) {
      this.htmlOutputMode.checked = true;
    }
    this.htmlOutputMode.addEventListener("change", function() {
      if (this.checked) {
        localStorage['b_project.htmlOutputMode'] = this.checked;
      } else {
        localStorage.removeItem("b_project.htmlOutputMode");
      }
    }, false);

    document.conv.projectMode.addEventListener("change", () => { this.switchProceduresVisible(); }, false);
    this.switchProceduresVisible();
  }

  switchProceduresVisible() {
    if (!this.displayProcedure.checked) { return; }
    let procedures = document.getElementsByClassName('procedure-switch');
    Array.from(procedures).forEach(function(_procedure) {
      if (_procedure.classList.contains('procedure-' + document.conv.projectMode.value)) {
        _procedure.classList.add('visible');
      } else {
        _procedure.classList.remove('visible');
      }
    });
  }

  // Manuscript → Item 原稿からアイテムを取得
  setPlayerNumber() {
    let _lines = settingsParams.playerNumber.match(/^ *\d{1,3} [ \S]*/gm);
    log(_lines);
    let _staffLines = settingsParams.staffNumber.match(/^\d{1,3} [ \S]*/gm);
    let _pitcher = settingsParams.playerNumber.match(/投手\n([\s\S]*?\n)\n+/);
    if (!_lines || !_pitcher || !_staffLines) { tool.errors = '選手情報が取得できませんでした。<br>player_number.txtを確認してください。' }
    let _this = this, _key;

    //選手
    _lines.forEach(function(_line) {
      _line = _line.match(/^\s*(\d{1,3}) ([ \S]*)/);
      _line[2] = Convert.zenkaku(_line[2]);
      _key = _line[2].replace(/\s/g, '');
      _this.player[_key] = [];
      _this.player[_key].number = _line[1];
      _this.player[_key].name = _line[2];
      _this.player[_key].isPitcher = _pitcher[1].match(_line[0]) ? true : false;
    });

    //監督・コーチの取得
    _staffLines.forEach(function(_line) {
      _line = _line.match(/^(\d{1,3}) ([ \S]*)/);
      _line[2] = Convert.zenkaku(_line[2]);
      _key = _line[2].replace(/\s/g, '');
      _this.player[_key] = [];
      _this.player[_key].number = _line[1];
      _this.player[_key].name = _line[2];
      _this.player[_key].isPitcher = _pitcher[1].match(_line[0]) ? true : false;
    });

    //console.table(this.player);
  }

  /**
   * partIdを使って原稿テンプレートを取得する。
   * this.settings.template[] パーツごと原稿が入っている
   */
  getTemplateParts(partsId) {
    if (typeof this.settings.template[partsId] === 'undefined') { console.error('テンプレート:' + partsId + 'は定義されていません'); return; }
    return this.settings.template[partsId].replace(/^\s*\n/, '').replace(/\n +$/, '\n').replace(/^ {4}|/gm, '');
  }

  /**
   * テンプレート合成
   * this.items[](manuscriptId)とテンプレート(partsIdを指定)を合成してソースを作成する。
   * @param partsId {string} テンプレートの名前
   *     e.g. loop, footerFp
   *     this.settings.template[] に原稿を指定しておく必要がある。
   *     tool.settings = Module.cloneAssoc(settingsTemplate.media);
   * @param manuscriptId {string} 情報を使用する原稿のID
   *     e.g. 0, 1, news, media
   *     あらかじめ this.getItems(manuscripts);
   *     もしくは this.getItemsEdited();
   *     で this.items[] に原稿を取得しておく必要がある
   * @return {string} HTMLソース
   */
  getTemplateReplace(partsId, manuscriptId = 0) {
    let source = this.getTemplateParts(partsId);
    if (typeof source === 'undefined') { return; }
    //console.table(tool.settings.itemDefine);

    // プレイスホルダーを定義する(プレースホルダの種類だけループ)
    for (let itemId in this.items[manuscriptId]) {
      this.regItem = new RegExp('{:' + itemId + '}', 'g');
      this.regHasItem = new RegExp('\\{\\?' + itemId + ' ([\\s\\S]*?)\\}\\n?', 'g');
      this.regHasnotItem = new RegExp('\\{\\!' + itemId + ' ([\\s\\S]*?)\\}\\n?', 'g');
      if (this.items[manuscriptId][itemId] !== null && this.items[manuscriptId][itemId] !== "") {
        //原稿に項目があったとき
        source = source.replace(this.regItem, this.items[manuscriptId][itemId]);
        source = source.replace(this.regHasItem, '$1\n');
        source = source.replace(this.regHasnotItem, '');
      } else {
        //原稿に項目がなかったとき
        source = source.replace(this.regItem, '');
        source = source.replace(this.regHasItem, '');
        source = source.replace(this.regHasnotItem, '$1\n');
      }
      // log(itemId + ': ' + this.items[manuscriptId][itemId]);
    }

    //{:count}の実行
    source = source.replace(/{:count}/g, ('0' + ++this.imgCount).slice(-2));

    //{:date_url}{:position}Lメルマガのみ実行
    if (this.filename === 'l_mmbranch.html') {
      source = source.replace(/{:date_url}/g, this.itemsCommon['date_url']);
      source = source.replace(/{:position}/g, this.positionClass === 0 ? 'left' : 'right' );
      this.positionClass === 0 ? 1 : 0;
    }
    return source;
  }

  /**
   * 原稿 → アイテム
   * 原稿から各種アイテムを取得し、this.items[原稿パーツID][アイテムID]に全て格納する。
   */
  getItems(manuscripts = [], addFilter) {
    this.manuscripts = manuscripts;
    if (typeof this.manuscripts === 'string') {
      this.manuscripts = [this.manuscripts];
    }
    for (let manuscriptId = 0; manuscriptId < this.manuscripts.length; manuscriptId++) {
      let itemId = "";
      let _matchItem = [];

      this.items[manuscriptId] = [];
      //console.table(this.settings.itemDefine);

      // プレイスホルダーを定義する(プレースホルダの種類だけループ)
      for (let itemId in this.settings.itemDefine) {
        if (typeof this.settings.itemDefine[itemId] !== 'object') {
          //定義がプリミティブ型だった場合
          //log(this.manuscripts[manuscriptId].match(new RegExp(this.settings.itemDefine[itemId]))[1]);
          _matchItem = this.manuscripts[manuscriptId].match(new RegExp(this.settings.itemDefine[itemId]));
          if (_matchItem !== null) {
            this.items[manuscriptId][itemId] = _matchItem[1];
          } else {
            this.items[manuscriptId][itemId] = "";
          }
        } else {
          this.getSpecialMedia(manuscriptId, itemId);
          this.getSpecialLocalCalendar(manuscriptId, itemId);
        }

        if (itemId === 'publisher' && !this.items[manuscriptId][itemId]) { //メディア：千葉日報
          if (/ 朝刊$/.test(this.items[manuscriptId]['media'])) {
            this.items[manuscriptId][itemId] = this.items[manuscriptId]['media'].replace(/ 朝刊$/, '');
          }
        }

        //addFilterを実行する
        if (addFilter) { addFilter(this.items[manuscriptId][itemId]); }
        log('[' + itemId + '] ' + this.items[manuscriptId][itemId]);
      }
    }
  }

  /** メディア掲載情報のgetItems特例 */
  getSpecialMedia(manuscriptId, itemId) {
    if (itemId === 'player_name') {
      //選手名(メディア掲載情報用 肩書きをつけない)
      let _name = this.manuscripts[manuscriptId].match(new RegExp(this.settings.itemDefine['player']))[1].replace(/投手$|選手$|監督$|コーチ$/, '');
      if (this.player[_name]) {
        //データ型をmatchの配列にあわせて背番号を取得
        this.items[manuscriptId][itemId] = this.player[_name].name;
      } else {
        this.items[manuscriptId][itemId] = "";
      }
    }
    else if (itemId === 'player_number') {
      //背番号だった場合
      let _name = this.manuscripts[manuscriptId].match(new RegExp(this.settings.itemDefine['player']))[1].replace(/投手$|選手$|監督$|コーチ$/, '');
      if (this.player[_name]) {
        //データ型をmatchの配列にあわせて背番号を取得
        this.items[manuscriptId][itemId] = this.player[_name].number;
      } else {
        this.items[manuscriptId][itemId] = "";
      }
    }
    else if (itemId === 'publisher') {
      let _matchItem = this.manuscripts[manuscriptId].match(new RegExp(this.settings.itemDefine['publisher'][0]));
      if (_matchItem !== null) {
        this.items[manuscriptId][itemId] = _matchItem[1];
      } else {
        this.items[manuscriptId][itemId] = "";
      }
      log(this.items[manuscriptId]['publisher']);
    }
    else if (itemId === 'media_news') {
      //ニュースでのメディア名(出版社とメディア名が被らないように)
      if (this.items[manuscriptId]['media'].indexOf(this.items[manuscriptId]['publisher']) < 0) {
        this.items[manuscriptId][itemId] = this.items[manuscriptId]['publisher'] + ' 『' + this.items[manuscriptId]['media'] + '』';
      } else {
        this.items[manuscriptId][itemId] = this.items[manuscriptId]['media'];
      }
    }
    else if (itemId === 'airtime') {
      let _date = this.items[manuscriptId]['date'];
      if (_date.match(/\d{1,2}:\d{2}/)) {
        _date = _date.match(/\d{1,2}:\d{2}/);
        this.items[manuscriptId][itemId] = _date + '～';
      } else {
        this.items[manuscriptId][itemId] = "";
      }
    }
    else if (itemId === 'date_csv') {
      let _date = this.items[manuscriptId]['date'];
      _date = _date.replace(/(\d{1,2})月(\d{1,2})日.*/, settings.thisyear + '/$1/$2');
      this.items[manuscriptId][itemId] = _date;
    }
  }
  getSpecialLocalCalendar(manuscriptId, itemId) {
    if (itemId === 'date_id') {
      let _date = this.items[manuscriptId]['date'];
      _date = _date.replace(/(\d{1,2})月(\d{1,2})日[\s\S]*/, function (_all, _m, _d) {
        return settings.thisyear % 100 + Convert.zeroPadding(_m) + Convert.zeroPadding(_d);
      });
      this.items[manuscriptId][itemId] = _date;
    }
    if (itemId === 'date_md') {
      let _date = this.items[manuscriptId]['date'];
      _date = _date.replace(/(\d{1,2})月(\d{1,2})日[\s\S]*/, '$1月$2日');
      this.items[manuscriptId][itemId] = _date;
    }
    if (itemId === 'date_m') {
      let _date = this.items[manuscriptId]['date'];
      _date = _date.replace(/(\d{1,2})月(\d{1,2})日[\s\S]*/, '$1');
      this.items[manuscriptId][itemId] = _date;
    }
  }

  getItemsEdited() {
    for (let _manuscriptId in this.items) {
      for (let itemId in this.items[_manuscriptId]) {
        this.items[_manuscriptId][itemId] = document.getElementById('media' + _manuscriptId + '_' + itemId).value;
      }
    }
    console.table(this.items);
  }

  /**
   * ItemsとTemplateを合成してコードやCSVのソースを取得する
   * @param outputType {string} json/html/csv のどれかを指定する
   */
  setTemplateOutput(outputType, outputId, inputValue = "") {
    let template;

    template = document.getElementById('outputTemplate' + Convert.capitalize(outputType));
    let clone = document.importNode(template.content, true);
    clone.children[0].children[0].innerHTML += ' (' + outputId + ')';
    clone.children[0].children[1].children[0].name += outputId;

    document.getElementById('outputForms').appendChild(clone);
    document.conv['after' + outputId].value = inputValue;
  }

  /**
   * Items編集フォームリストを出す
   * this.items[]を利用して項目の編集フォームを表示する。
   */
  setItemsEditor() {
    const adjustForms = document.getElementById('itemsEditor');
    const templateParts = document.getElementById('itemsEditorTemplate');
    const templateItems = document.getElementById('itemsEditorFormTemplate');
    adjustForms.innerHTML = "";
    let clone, cloneItem;
    let _itemFormGroup;
    let formGroupId;
    let formInputId;

    for (let _manuscriptId in tool.items) {
      clone = document.importNode(templateParts.content, true);

      clone.children[0].children[0].children[0].innerHTML = _manuscriptId;
      formGroupId = 0;
      for (let itemId in tool.items[_manuscriptId]) {
        cloneItem = document.importNode(templateItems.content, true);
        formInputId = 'media' + _manuscriptId + '_' + itemId;

        clone.children[0].children[0].children[0].innerHTML = 'Media ' + (parseInt(_manuscriptId, 10) + 1);
        cloneItem = document.importNode(templateItems.content, true);

        cloneItem.children[0].children[0].innerHTML = itemId;
        cloneItem.children[0].children[0].setAttribute('for', formInputId);
        cloneItem.children[0].children[1].children[0].id = formInputId;
        if(tool.items[_manuscriptId][itemId].length > 40) {
          cloneItem.children[0].children[1].children[0].classList.add('multiline')
        }
        cloneItem.children[0].children[1].children[0].value = tool.items[_manuscriptId][itemId];

        clone.children[0].children[0].children[1].children[0].appendChild(cloneItem);

        formGroupId++;
      }

      //clone.firstElementChild.style.background = '#'+Math.floor(Math.random()*16777215).toString(16);
      document.getElementById('itemsEditor').appendChild(clone);
    }
  }

  /** プレビュー出力を上書きする */
  previewRefresh(str) {
    this.outputArea.children[1].innerHTML = this.outputFilter(str);
    this.outputArea.setAttribute('style','visibility: visible; opacity: 1; transition: 2s;');
  }

  // ショートカットキーの上書き
  shortcutKey(e) {
    var _this = this;
    document.addEventListener('keydown', function(e) {
      if(e.shiftKey) {
        if(e.keyCode === 13) { //Enter
          var active = document.activeElement;
          log(active.form.dataset.role);
          if(active == _this.before) {
            convertOrder();
          } else if(active.form.dataset.role === 'itemsEditor') {
            _this.refreshOrder();
          }
          e.preventDefault();
        }
      }
      /*
      if(navigator.userAgent.match(/Mac|PC/)) {
        if(e.keyCode === 83 && e.metaKey) { convertOrder(); }
      } else {
        if(e.keyCode === 83 && e.ctrlKey) { convertOrder(); }
      } //C: 67
      */
    });
  }

  /** Items修正フォームの内容を反映する */
  refreshOrder(str) {
    tool.convertPrepare();
    tool.getItemsEdited();
    str = setSourceMedia();
    tool.finish('フォームの内容で再設定しました。', str);
  }
}


/**
 * Mailmagazineページ
 * チームAのメールマガジン
 */
class ConverterPageMl extends ConverterPageProject
{
  constructor(args) {
    super(args);
    this.before = args.after || document.conv.before;
    this.afterWeb = args.afterWeb || document.conv.afterWeb;
    this.afterTitleWeb = args.afterWeb || document.conv.afterTitleWeb;
    this.afterMobile = args.afterMobile || document.conv.afterMobile;
    this.afterTitleMobile = args.afterMobile || document.conv.afterTitleMobile;
    this.positionClass = 0;
    this.finishOption = 'notProof';
  }

  //Items取得の上書き(メルマガ用の特例登録)
  getItems(manuscripts = [], addFilter) {
    if (typeof manuscripts === 'string') {
      manuscripts = [manuscripts];
    }
    for (let manuscriptId = 0; manuscriptId < manuscripts.length; manuscriptId++) {
      let itemId = "";
      let _matchItem = [];

      this.items[manuscriptId] = [];
      //console.table(this.settings.itemDefine);

      // プレイスホルダーを定義する(プレースホルダの種類だけループ)
      for (let itemId in this.settings.itemDefine) {
        if (typeof this.settings.itemDefine[itemId] !== 'object') {
          //定義がプリミティブ型だった場合
          //log(manuscripts[manuscriptId].match(new RegExp(this.settings.itemDefine[itemId]))[1]);
          _matchItem = manuscripts[manuscriptId].match(new RegExp(this.settings.itemDefine[itemId]));

          if (_matchItem !== null) {
            this.items[manuscriptId][itemId] = _matchItem[1];
          } else {
            this.items[manuscriptId][itemId] = "";
          }
        }
        if (itemId === 'date') {
          if (this.items[manuscriptId][itemId]) {
            this.itemsCommon['date_url'] = this.items[manuscriptId]['date'].replace(/\d{2}(\d{2})\.(\d{1,2}).(\d{1,2})/, '$1$2$3');
          }
        }
        if (itemId === 'headline_heading' || itemId === 'topics_heading' || itemId === 'pr_heading' || itemId === 'pr_text') {
          this.items[manuscriptId][itemId] = this.textFilter(this.items[manuscriptId][itemId], {day: true});
        }
        if (itemId === 'headline_text') {
          //log(this.items[manuscriptId][itemId]);
          this.items[manuscriptId][itemId] = '<p class="topicsTxt01" style="text-align: left;font-size: 14px;line-height: 19px;margin: 0 13px 15px;">\n'
          + this.items[manuscriptId][itemId]
          .replace(/^[\s\S]*?(?=\n.*?@@url\(.*?\)@@)/, (_all) => {
            return this.items[manuscriptId][itemId] = this.textFilter(_all, {day: true, br: true, date: true});
          })
          //青リンク
          .replace(/◆(.*?)\s+・PC\/スマホ (@@url\(.*?\)@@)\s+(?:・携帯 @@url\(.*?\)@@)?\s*/g, '\<a class="topicsLink01" href="$2" style="display: block;background-color: #2D486B;text-decoration: none;font-size: 12px;line-height: 50%;color: #fff;border-radius: 4px;margin: 10px auto 0;padding: 15px 0;text-align: center;clear: both;"><span style="background: url(http://www.a.example.com/dummy/_img/icon_pickUpLinkArrow01.png) no-repeat 0 50%;font-size: 15px;font-weight: bold;line-height: 16px;padding: 0 0 0 20px;">$1</span></a>\n')
          //赤リンク
          .replace(/・PC\/スマホ (@@url\(.*?\)@@)\s+(?:・携帯 @@url\(.*?\)@@)?\s*/g, '</p>\n<a class="topicsLink01" href="$1" style="display: block;background-color: #8c0007;text-decoration: none;font-size: 12px;line-height: 50%;color: #fff;border-radius: 4px;margin: 0 auto;padding: 15px 0;text-align: center;clear: both;"><span style="background: url(http://www.a.example.com/dummy/_img/icon_pickUpLinkArrow01.png) no-repeat 0 50%;font-size: 15px;font-weight: bold;line-height: 16px;padding: 0 0 0 20px;">詳細はこちら</span></a>');
        }
        if (itemId === 'lead') {
          this.items[manuscriptId][itemId] = this.textFilter(this.items[manuscriptId][itemId], {day: true, br: true, date: true});
        }
        if (itemId === 'pr_text') {
          this.items[manuscriptId][itemId] = this.textFilter(this.items[manuscriptId][itemId], {day: true, date: true});
        }
        //addFilterを実行する
        if (addFilter) { addFilter(this.items[manuscriptId][itemId]); }

        //if (this.items[manuscriptId][itemId] && this.items[manuscriptId][itemId].length > 30) { log('{:' + itemId + '} ' + this.items[manuscriptId][itemId] ); }
        //log('{:' + itemId + '} ' + this.items[manuscriptId][itemId]);
      }
    }
  }

  /**
   * 本文の文字装飾をつける
   * @param option {array} 配列内の添え字に対してtrueを代入することで変更内容を変更する
   * day:曜日の着色 br:改行タグを入れる date:日付をM月D日表記に変換
   */
  textFilter(str, option) {
    option.day = option.day || true;
    option.br = option.br || false;
    option.date = option.date || false;
    if (option.day === true) {
      str = str.replace(/\((日|\S・祝)\)/g, '(<span style="color: #c33;">$1</span>)')
      .replace(/\(土\)/g, '(<span style="color: #0476B4;">土</span>)');
    }
    if (option.br === true) {
      str = str.replace(/\n/g, '<br />\n');
    }
    if (option.date === true) {
      str = Convert.dateFormat(str);
    }
    str = str.replace(/\s+$/g, '');
    return str;
  }

  // プレビュー更新の上書き(mmbranch)
  previewRefresh(str) {
    this.outputArea.children[1].innerHTML = this.outputFilter(str);
    this.outputArea.setAttribute('style','visibility: visible; opacity: 1; transition: 2s;');
  }

  /** 簡易プレビューで画像がみつからなかったときに実行する処理 */
  imgNotfound(node, alt = "not found") {
    node.outerHTML = '<div class="topicsImg01 dummy-img">' + alt + '</div>';
  }

}

class ConverterPageTrain extends ConverterPage
{
  constructor(args) {
    super(args);
    this.cssSelect = document.conv.cssSelect;
    this.cssMode = 'cssPc';
    this.finishOption !== 'notProof';

    for (let i = 0; i < 3; i++) {
      log(this.cssSelect[i]);
      let _this = this;
      this.cssSelect[i].addEventListener("change", () => {
        let select = document.conv.cssSelect.value;
        document.getElementById('cssPc').disabled = select === 'cssPc' ? false : true;
        document.getElementById('cssSp').disabled = select;
        document.getElementById('cssFp').disabled = select === 'cssFp' ? false : true;
        this.cssMode = select;
        this.refreshOrder();
      }, false);
    }
  }

  //ショートカットキーの上書き
  shortcutKey(e) {
    document.addEventListener('keyup', (e) => {
      this.refreshOrder();
      if(e.shiftKey) {
        this.refreshOrder();
      }
    });
  }

  //更新の上書き
  refreshOrder() {
    if(this.after.value) {
      Convert.log.clear();
      Convert.proof(this.after.value);
      window.setTimeout(() => { this.finish(''); this.after.focus(); }, 100);
    }
  }
}

/**
 * 汎用静的クラス
 */
class Module
{
  /** 受け取った文字列をクリップボードにコピー */
  static setClipboard(str){
    var temp = document.createElement('textarea');
    temp.value = str;
    temp.selectionStart = 0;
    temp.selectionEnd = temp.value.length;
    temp.style.position = 'fixed';
    temp.style.left = '-100%';
    document.body.appendChild(temp);
    temp.focus();
    var result = document.execCommand('copy');
    temp.blur();
    document.body.removeChild(temp);
    //alert(result); //成否の表示
  }

  /** 日付取得 */
  static getNow(format) {
    var date =new Date();
    return format
    .replace('yyyy', date.getFullYear())
    .replace('yy', date.getFullYear()%100)
    .replace('mm', ('0'+(date.getMonth()+1)).slice(-2))
    .replace('dd', ('0'+date.getDate()).slice(-2))
    .replace('m', date.getMonth()+1)
    .replace('d', date.getDate())
    .replace('h', date.getHours())
    .replace('m', date.getMinutes())
    .replace('s', date.getSeconds());
  }

  /** 配列の値を全て数値として合計する sum(array); */
  static sumArray(arr) {
    return arr.reduce(function(prev, current, i, arr) {
      current = current.replace(/[X]/g, '');
      return Number(prev) + Number(current);
    });
  };

  /** 文字列中の特定の文字列の登場回数をカウントする Module.substrCount('thought', 't'); */
  static substrCount(str, substr) {
    return (str.match(new RegExp(substr, 'g')) || []).length;
  }

  /** 連想配列を参照渡しせずに複製する (RegExpは持てない) */
  static cloneAssoc(array) {
    return JSON.parse(JSON.stringify(array));
  }
}

/**
 * 未検出時に空文字を返すmatchメソッド
 * '文字列'.matchStr(/(group)\d/, 1)
 *
 * @param reg {regexp} 正規表現
 * @param group {number} グループ数
 */
String.prototype.matchStr = function (reg, group = 0) {
  let str = this.match(reg);
  if (str === null) {
    if (reg.global) {
      str = [''];
    } else {
      if (group === 0) {
        str = '';
      } else {
        str = [''];
        for (let i = group; group > 0; group--) { str.push(''); }
      }
    }
  }
  return str;
}
/**
 * 第一グループを返すmatchメソッド
 * '文字列'.matchStr(/(group)\d/)
 *
 * @param reg {regexp} グループ化を含む正規表現
 * @param group {number} グループ数
 */
String.prototype.matchGroup = function (reg, group = 1) {
  let match = this.match(reg);
  if (group < 2) {
    if (match === null) {
      return '';
    }
    return match[1];
  } else {
    if (match === null) {
      match = [''];
      for (let i = group; group > 0; group--) { match.push(''); }
    }
    match.shift();
    return match;
  }
}
