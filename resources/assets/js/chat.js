'use strict';

$(function(){

    var w = window;

    w.CHAT = {
        msgObj: '#msg-list',
        username: null,
        userid: null,
        role: null,
        room: null,
        socket: null,
        scrollToBottom: function(){
            $(this.msgObj).scrollTop(document.getElementById("msg-list").clientHeight);
        },

        submit: function(){
            var $content = $('#textarea-input');
            var content = $content.val();
            if(content != ''){
                var obj = {
                    room: this.room,
                    userid: this.userid,
                    username: this.username,
                    role: this.role,
                    content: content,
                    time: Date.now()
                };

                this.socket.emit('message', obj);
                $content.val('');
            }
        },
        genUid: function(){
            return new Date().getTime()+""+Math.floor(Math.random()*899+100);
        },
        //更新系统消息，本例中在用户加入、退出的时候调用
        updateSysMsg: function(o, action){
            //当前在线人数
            var onlineCount = o.onlineCount;
            //更新在线人数
            $('.onlinecount').html('当前共有 '+onlineCount+' 人在线');

        },
        //更新系统消息，用户（撤销）禁言，设置（撤销）管理员
        sendSysMsg: function(obj){
            var section = '<div data-id="'+ obj.userid +'" class="chat-section">'
                + (obj.username==CHAT.username ? '<font class="n is-own '+(obj.role == 2 ? 'no-admin' : 'admin')+'"><span>' + '我（' + obj.username + '）：</span>' :'<font class="n no-own '+(obj.role == 2 ? 'no-admin' : 'admin')+'"><a href="javascript:" >'+obj.username+'：</a>' )
                + '</font>'

                + '<div class="chat-content">'+ obj.content +'</div>'
                + '</div>';

            $(CHAT.msgObj).append(section);
            CHAT.scrollToBottom();
        },
        //系统通知
        updateNotice: function(obj){
            var section = '<div class="chat-section">'
                + '<p class="notice-content">'+ obj.msg +'</p>'
                + '</div>';

            $(CHAT.msgObj).append(section);
            CHAT.scrollToBottom();
        },
        init: function(){
            /*
             |  客户端使用ip对用户进行唯一标记
             |  实际项目中，如果是需要用户登录，那么直接采用用户的uid来做标识就可以
             */
            var channelRoom = $('.channel-room');
            var urlRoom = location.href.split('/')[3];
            if(urlRoom){
                channelRoom.val(urlRoom);
                var newRoomName = $('.channel-room option:selected').text();
                $('.channel-p').html(newRoomName);
            }
            this.userid = w.userinfo.uid || w.userinfo.name;
            this.username = w.userinfo.name;
            this.role = w.userinfo.role || 2;
            this.room = channelRoom.val() || $('.channel-room option:first').val();
            this.scrollToBottom();

            //连接websocket后端服务器
            this.socket = io.connect('http://127.0.0.1:8000/message', {path: '/stream' });

            //监听新用户登录
            this.socket.on('login', function(o){
                CHAT.updateSysMsg(o, 'login');
            });

            var self = this;
            this.socket.on('connect', function(){
                //告诉服务器端有用户进入聊天室
                self.socket.emit('login', {userid:self.userid, username:self.username, room:self.room});
            });

            //监听用户退出
            this.socket.on('logout', function(o){
                CHAT.updateSysMsg(o, 'logout');
            });

            //监听消息发送
            this.socket.on('message', function(obj){

                var section = '<div data-id="'+ obj.userid +'" class="chat-section">'
                    + (obj.username==CHAT.username ? '<font class="n is-own"><span>' + '我（' + obj.username + '）：</span>' :'<font class="n no-own '+(obj.role == 2 ? 'no-admin' : 'admin')+'"><a href="javascript:" >'+obj.username+'：</a>' )
                    + '</font>'

                    + '<div class="chat-content">'+ obj.content +'</div>'
                    + '</div>';

                $(CHAT.msgObj).append(section);
                CHAT.scrollToBottom();
            });

            //监听禁言用户
            this.socket.on('banned', function(obj){
                CHAT.sendSysMsg(obj);
            });

            //监听撤销用户禁言
            this.socket.on('unbanned', function(obj){
                CHAT.sendSysMsg(obj);
            });

            //监听设置管理员
            this.socket.on('setMember', function(obj){
                CHAT.sendSysMsg(obj);
            });

            //监听撤销管理员
            this.socket.on('revokeMember', function(obj){
                CHAT.sendSysMsg(obj);
            });

            //监听通知
            this.socket.on('notice', function(obj){
                CHAT.updateNotice(obj);
            });
        }
    };

    CHAT.init();

    //通过“回车""提交信息
    $("#textarea-input").keydown(function(e) {
        e = e || event;
        if (e.keyCode === 13) {
            CHAT.submit();
        }
    });
    $('.chat-container').delegate('#chat_btn', 'click', function(){
            if($("#textarea-input").val!=""){
                CHAT.submit();
            }
        })
        //登录窗口
        .delegate('#click_login', 'click', function(){
            $('.login-container').addClass('container-on');
            $('.shadow-bg').show();
        })

        //表情按钮
        .delegate('#btn-emoji', 'click', function(){
            var $emojiContainer = $('#emoji-container');
            if($emojiContainer.hasClass('ng-hide')){
                $emojiContainer.removeClass('ng-hide');
            }else{
                $emojiContainer.addClass('ng-hide');
            }
        })
        .delegate('#textarea-input', 'focus', function(){
            var $emojiContainer = $('#emoji-container');
            if(!$emojiContainer.hasClass('ng-hide')){
                $emojiContainer.addClass('ng-hide');
            }
        })
        //切换频道
        .delegate('.channel-room', 'change', function () {
            var newRoom = $(this).val();
            var newRoomName = $(this).find("option:selected").text();
            $('.channel-p').html(newRoomName);
            var stateObject = {};
            var title = newRoomName;
            var newUrl = "/" + newRoom;
            history.pushState(stateObject,title,newUrl);

            //通知socket，切换room
            CHAT.socket.emit('leave', {userid: CHAT.userid, lastRoom: CHAT.room, newRoom: newRoom, newRoomName: newRoomName});
            CHAT.room = newRoom;

            //更新聊天内容
            CHAT.socket.on('loadMsg', function(obj){
                var section = '';
                for(var i=0; i<obj.chats.length; i++){
                    var chat = JSON.parse(obj.chats[i]);
                    section += '<div data-id="'+ chat.userid +'" class="chat-section">'
                        + (chat.username==CHAT.username ? '<font class="n is-own"><span>' + '我（' + chat.username + '）：</span>' :'<font class="n no-own '+(chat.role = 2 ? 'no-admin' : 'admin')+'"><a href="javascript:" >'+chat.username+'：</a>' )
                        + '</font>'
                        + '<div class="chat-content">'+ chat.content +'</div>'
                        + '</div>';
                }


                $(CHAT.msgObj).html(section);
                CHAT.scrollToBottom();
            });
        })
        .delegate('.emoji-item', 'click', function(){
            var $textInput = $('#textarea-input');
            var tmp = $textInput.val();
            $textInput.val(tmp + '[' + $(this).data('id') +']');
        });

    $('.login-container')
    //关闭登录窗口
        .delegate('#close-x', 'click', function(){
            $('.login-container').removeClass('container-on');
            $('.shadow-bg').hide();
        })
        //验证码
        .delegate('#verify-code', 'click', function(){
            $(this).attr('src', '/captcha/code?rc=' + Math.random());
        })
        //切换“登录”|“注册”
        .delegate('.left', 'click', function(){
            if(!$(this).hasClass('on')){
                $('.switch-label').removeClass('on');
                $(this).addClass('on');

                $('#verify-code').attr('src', '/captcha/code?rc=' + Math.random());

                $('#userid').val('');
                $('#pwd').val('');
                $('#vdcode').val('');
                $('.confirm-pwd').hide();
                $('.submit-login').html('<button id="btn_login" name="btn-login" type="submit">登 录</button>');
                $('.show-msg').hide();
            }
        })
        .delegate('.right', 'click', function(){
            if(!$(this).hasClass('on')){
                $('.switch-label').removeClass('on');

                $(this).addClass('on');

                $('#verify-code').attr('src', '/captcha/code?rc=' + Math.random());
                $('#userid').val('');
                $('#pwd').val('');
                $('#vdcode').val('');

                $('.confirm-pwd').show();
                $('.submit-login').html('<button id="btn_reg" name="btn-signin" type="submit">注 册</button>');
                $('.show-msg').hide();
            }
        })
        .delegate('#btn_login', 'click', function(){
            if(!checkEmpty('login')){
                return false;
            }
            var data = $('.login-form').serialize();
            $.post('/user/login',data, function(res){
                if(!res.succ){

                    $('.show-msg').html(res.results.msg|| '抱歉！未知错误，请重试').show();
                    return false;
                }else{
                    alert(res.results.msg || '登录成功！');
                    $('.login-container').removeClass('container-on');
                    $('.shadow-bg').hide();
                    window.location.reload();
                }
            }, 'json');
        })
        .delegate('#btn_reg', 'click', function(){
            if(!checkEmpty('reg')){
                return false;
            }
            var data = $('.login-form').serialize();
            $.post('/user/register',data, function(res){
                if(!res.succ){

                    $('.show-msg').html(res.results.msg|| '抱歉！未知错误，请重试').show();
                    return false;
                }else{
                    $('.show-msg').hide();
                    alert(res.results.msg || '注册成功！');
                    $('.login-container').removeClass('container-on');
                    $('.shadow-bg').hide();
                    window.location.reload();
                }
            }, 'json');
        });

    //判断是否为空
    function checkEmpty(state){
        var $userAccount = $('#userid'),
            $pwd = $('#pwd'),
            $rePwd = $('#confirmPassword'),
            $vCode = $('#vdcode'),
            $showMsg =$('.show-msg');
        if($userAccount.val()==""){
            $showMsg.html('请输入账号').show();
            $userAccount.focus();
            return false;
        }
        if($pwd.val()==""){
            $showMsg.html('请输入密码').show();
            $pwd.focus();
            return false;
        }
        if(state == 'reg'){
            if($rePwd.val()==""){
                $showMsg.html('请再次输入密码').show();
                $rePwd.focus();
                return false;
            }
            if($rePwd.val()!=""){
                if($pwd.val()!=$rePwd.val()){
                    $showMsg.html('两次输入密码不一致').show();
                    $rePwd.focus();
                    return false;
                }
            }
        }
        if($vCode.val()==""){
            $showMsg.html('请输入验证码').show();
            $vCode.focus();
            return false;
        }
        return true;
    }

    /*
     |-------------------------------------------
     | 鼠标右键事件操作
     | 清除屏幕
     */
    $('.chat-list').on('contextmenu', function(e){
        e.stopPropagation();
        e.preventDefault();

        createMenu({
            items: {
                clear: {
                    name: "清除屏幕",
                    callback: function(){
                        $('#msg-list').empty();
                    }
                }
            }
        });
    });
    /*
     |-------------------------------------------
     | 鼠标右键点击用户名的事件操作
     | .举报发言
     | .禁言
     | .设置为管理员
     */
    $('#msg-list').delegate('.no-own', 'contextmenu', function(e){

        var self = this;
        var uid = $(self).parent().data('id');
        //判断是否管理员
        if(CHAT.role < 2){
            e.stopPropagation();
            e.preventDefault();
console.log(uid);
            CHAT.socket.emit('context', {uid: uid});
            CHAT.socket.on('context', function(obj){
                createMenu( obj );
            });

        }else {
            return false;
        }
    });

    document.onmousemove=mouseMove;//记录鼠标位置

    var mx=0,my=0;
    function mouseMove(ev){
        ev = ev||window.event;
        var mousePos = mouseCoords(ev);
        mx = mousePos.x;
        my = mousePos.y;
    }
    function mouseCoords(ev){
        if(ev.pageX||ev.pageY){
            return{
                x:ev.pageX,
                y:ev.pageY
            };
        }
        return{
            x:ev.clientX,
            y:ev.clientY+$(document).scrollTop()
        };
    }

    function createMenu (opts){
        if(!opts){
            throw "创建菜单项createMenuItem函数参数非法，必须设置菜单项参数！";
        }
        $('.dropDown').empty();
        $.each(opts.items, function (key, item) {
           var $li = $('<li class="context-menu-item"></li>').append(item.name);

            if(key == 'clear'){
                $li.on('click', function(){
                    item.callback();
                });
            }else{
                $li.on('click', function(){
                    CHAT.socket.emit(item.event, opts.uid);
                });
            }
            $li.appendTo('.dropDown');
        });

        var $body = $('body'),
            $contextMenu = $('#contextMenu');

        var mw = $body.width(),
            mhh = $('html').height(),
            mbh = $body.height(),
            w = $contextMenu.width(),
            h = $contextMenu.height(),
            mh = (mhh > mbh) ? mhh : mbh;//最大高度 比较html与body的高度
        if(mh < h+my){
            my = mh-h;
        }//超 高
        if(mw < w+mx){
            mx = mw-w;
        }//超 宽
        $contextMenu.hide().css({top:my, left:mx}).show();

        $(document).on('click', function(){
            $contextMenu.hide();
        }).on('contextmenu', function(){
            $contextMenu.hide();
        }).on('.chat-list', 'contextmenu', function(){
            $contextMenu.hide();
        });
    }

});
