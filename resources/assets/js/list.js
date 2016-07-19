'use strict';

$(function(){

    $('#chat_list').on('click', '.ban', function(){
        //禁言
        var uid = $(this).parent().data('uid');
        $.post('/user/ban', {
            uid: uid
        }).then(function(res){
            if(res.suc) {
                alert(res.msg);
            }else {
                alert(res.err);
            }
        });
    }).on('click', '.delete', function(){
        //删除言论
        var room = $(this).parent().data('room'),
            tid = $(this).parent().data('tid');
        $.post('/user/delChat', {
            room: room,
            tid: tid
        }).then(function(res){
            if(res.suc) {
                alert(res.msg);
                window.location.reload();
            }else {
                alert(res.err);
            }
        });
    });

});
