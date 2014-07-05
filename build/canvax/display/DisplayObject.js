/**
 * Canvax
 *
 * @author 释剑 (李涛, litao.lt@alibaba-inc.com)
 *
 * 模拟as3 DisplayList 的 现实对象基类
 */
KISSY.add('canvax/display/DisplayObject', function (S, EventDispatcher, Matrix, Point, Base, HitTestPoint, propertyFactory) {
    var DisplayObject = function (opt) {
        arguments.callee.superclass.constructor.apply(this, arguments);
        var self = this;    //如果用户没有传入context设置，就默认为空的对象
        //如果用户没有传入context设置，就默认为空的对象
        opt = Base.checkOpt(opt);    //设置默认属性
        //设置默认属性
        self.id = opt.id || null;    //相对父级元素的矩阵
        //相对父级元素的矩阵
        self._transform = null;    //心跳次数
        //心跳次数
        self._heartBeatNum = 0;    //元素对应的stage元素
        //元素对应的stage元素
        self.stage = null;    //元素的父元素
        //元素的父元素
        self.parent = null;
        self._eventEnabled = false;    //是否响应事件交互
        //是否响应事件交互
        self.dragEnabled = false;    //是否启用元素的拖拽
                                     //创建好context
        //是否启用元素的拖拽
        //创建好context
        self._createContext(opt);
        var UID = Base.createId(self.type);    //如果没有id 则 沿用uid
        //如果没有id 则 沿用uid
        if (self.id == null) {
            self.id = UID;
        }
        self.init.apply(self, arguments);    //所有属性准备好了后，先要计算一次this._updateTransform()得到_tansform
        //所有属性准备好了后，先要计算一次this._updateTransform()得到_tansform
        this._updateTransform();
    };
    Base.creatClass(DisplayObject, EventDispatcher, {
        init: function () {
        },
        _createContext: function (opt) {
            var self = this;    //所有显示对象，都有一个类似canvas.context类似的 context属性
                                //用来存取改显示对象所有和显示有关的属性，坐标，样式等。
                                //该对象为Coer.propertyFactory()工厂函数生成
            //所有显示对象，都有一个类似canvas.context类似的 context属性
            //用来存取改显示对象所有和显示有关的属性，坐标，样式等。
            //该对象为Coer.propertyFactory()工厂函数生成
            self.context = null;    //提供给Coer.propertyFactory() 来 给 self.context 设置 propertys
            //提供给Coer.propertyFactory() 来 给 self.context 设置 propertys
            var _contextATTRS = Base.copy({
                    width: 0,
                    height: 0,
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    scaleOrigin: {
                        x: 0,
                        y: 0
                    },
                    rotation: 0,
                    rotateOrigin: {
                        x: 0,
                        y: 0
                    },
                    visible: true,
                    cursor: 'default',
                    //canvas context 2d 的 系统样式。目前就知道这么多
                    fillStyle: null,
                    lineCap: null,
                    lineJoin: null,
                    lineWidth: null,
                    miterLimit: null,
                    shadowBlur: null,
                    shadowColor: null,
                    shadowOffsetX: null,
                    shadowOffsetY: null,
                    strokeStyle: null,
                    globalAlpha: 1,
                    font: null,
                    textAlign: 'left',
                    textBaseline: 'top',
                    arcScaleX_: null,
                    arcScaleY_: null,
                    lineScale_: null,
                    globalCompositeOperation: null
                }, opt.context, true);    //然后看继承者是否有提供_context 对象 需要 我 merge到_context2D_context中去的
            //然后看继承者是否有提供_context 对象 需要 我 merge到_context2D_context中去的
            if (self._context) {
                _contextATTRS = _.extend(_contextATTRS, self._context);
            }    //有些引擎内部设置context属性的时候是不用上报心跳的，比如做hitTestPoint热点检测的时候
            //有些引擎内部设置context属性的时候是不用上报心跳的，比如做hitTestPoint热点检测的时候
            self._notWatch = false;
            _contextATTRS.$owner = self;
            _contextATTRS.$watch = function (name, value, preValue) {
                //下面的这些属性变化，都会需要重新组织矩阵属性_transform 
                var transFormProps = [
                        'x',
                        'y',
                        'scaleX',
                        'scaleY',
                        'rotation',
                        'scaleOrigin',
                        'rotateOrigin'
                    ];
                if (_.indexOf(transFormProps, name) >= 0) {
                    this.$owner._updateTransform();
                }
                if (this.$owner._notWatch) {
                    return;
                }
                ;
                if (this.$owner.$watch) {
                    this.$owner.$watch(name, value, preValue);
                }
                this.$owner.heartBeat({
                    convertType: 'context',
                    shape: this.$owner,
                    name: name,
                    value: value,
                    preValue: preValue
                });
            };    //执行init之前，应该就根据参数，把context组织好线
            //执行init之前，应该就根据参数，把context组织好线
            self.context = propertyFactory(_contextATTRS);
        },
        /* @myself 是否生成自己的镜像 
         * 克隆又两种，一种是镜像，另外一种是绝对意义上面的新个体
         * 默认为绝对意义上面的新个体，新对象id不能相同
         * 镜像基本上是框架内部在实现  镜像的id相同 主要用来把自己画到另外的stage里面，比如
         * mouseover和mouseout的时候调用*/
        clone: function (myself) {
            var conf = {
                    id: this.id,
                    context: this.context.$model
                };
            if (this.img) {
                conf.img = this.img;
            }
            var newObj = new this.constructor(conf);
            if (!myself) {
                newObj.id = Base.createId(newObj.type);
            }
            return newObj;
        },
        heartBeat: function (opt) {
            //stage存在，才说self代表的display已经被添加到了displayList中，绘图引擎需要知道其改变后
            //的属性，所以，通知到stage.displayAttrHasChange
            var stage = this.getStage();
            if (stage) {
                this._heartBeatNum++;
                stage.heartBeat && stage.heartBeat(opt);
            }
        },
        getCurrentWidth: function () {
            return Math.abs(this.context.width * this.context.scaleX);
        },
        getCurrentHeight: function () {
            return Math.abs(this.context.height * this.context.scaleY);
        },
        getStage: function () {
            if (this.stage) {
                return this.stage;
            }
            var p = this;
            if (p.type != 'stage') {
                while (p.parent) {
                    p = p.parent;
                    if (p.type == 'stage') {
                        break;
                    }
                }
                ;
                if (p.type !== 'stage') {
                    //如果得到的顶点display 的type不是Stage,也就是说不是stage元素
                    //那么只能说明这个p所代表的顶端display 还没有添加到displayList中，也就是没有没添加到
                    //stage舞台的childen队列中，不在引擎渲染范围内
                    return false;
                }
            }    //一直回溯到顶层object， 即是stage， stage的parent为null
            //一直回溯到顶层object， 即是stage， stage的parent为null
            this.stage = p;
            return p;
        },
        localToGlobal: function (point, container) {
            !point && (point = new Point(0, 0));
            var cm = this.getConcatenatedMatrix(container);
            if (cm == null)
                return Point(0, 0);
            var m = new Matrix(1, 0, 0, 1, point.x, point.y);
            m.concat(cm);
            return new Point(m.tx, m.ty);    //{x:m.tx, y:m.ty};
        },
        //{x:m.tx, y:m.ty};
        globalToLocal: function (point, container) {
            !point && (point = new Point(0, 0));
            var cm = this.getConcatenatedMatrix(container);
            if (cm == null)
                return new Point(0, 0);    //{x:0, y:0};
            //{x:0, y:0};
            cm.invert();
            var m = new Matrix(1, 0, 0, 1, point.x, point.y);
            m.concat(cm);
            return new Point(m.tx, m.ty);    //{x:m.tx, y:m.ty};
        },
        //{x:m.tx, y:m.ty};
        localToTarget: function (point, target) {
            var p = localToGlobal(point);
            return target.globalToLocal(p);
        },
        getConcatenatedMatrix: function (container) {
            var cm = new Matrix();
            for (var o = this; o != null; o = o.parent) {
                cm.concat(o._transform);
                if (!o.parent || container && o.parent && o.parent == container || o.parent && o.parent.type == 'stage') {
                    //if( o.type == "stage" || (o.parent && container && o.parent.type == container.type ) ) {
                    break;
                }
            }
            return cm;
        },
        /*
         *设置元素的是否响应事件检测
         *@bool  Boolean 类型
         */
        setEventEnable: function (bool) {
            if (_.isBoolean(bool)) {
                this._eventEnabled = bool;
                return true;
            }
            ;
            return false;
        },
        /*
         *查询自己在parent的队列中的位置
         */
        getIndex: function () {
            if (!this.parent) {
                return;
            }
            ;
            return _.indexOf(this.parent.children, this);
        },
        /*
         *元素在z轴方向向下移动
         *@num 移动的层级
         */
        toBack: function (num) {
            if (!this.parent) {
                return;
            }
            var fromIndex = this.getIndex();
            var toIndex = 0;
            if (_.isNumber(num)) {
                if (num == 0) {
                    //原地不动
                    return;
                }
                ;
                toIndex = fromIndex - num;
            }
            var me = this.parent.children.splice(fromIndex, 1)[0];
            if (toIndex < 0) {
                toIndex = 0;
            }
            ;
            this.parent.addChildAt(me, toIndex);
        },
        /*
         *元素在z轴方向向上移动
         *@num 移动的层数量 默认到顶端
         */
        toFront: function (num) {
            if (!this.parent) {
                return;
            }
            var fromIndex = this.getIndex();
            var pcl = this.parent.children.length;
            var toIndex = pcl;
            if (_.isNumber(num)) {
                if (num == 0) {
                    //原地不动
                    return;
                }
                toIndex = fromIndex + num + 1;
            }
            var me = this.parent.children.splice(fromIndex, 1)[0];
            if (toIndex > pcl) {
                toIndex = pcl;
            }
            this.parent.addChildAt(me, toIndex - 1);
        },
        _transformHander: function (ctx) {
            var transForm = this._transform;
            if (!transForm) {
                transForm = this._updateTransform();
            }    //运用矩阵开始变形
            //运用矩阵开始变形
            ctx.transform.apply(ctx, transForm.toArray());    //设置透明度
                                                              //ctx.globalAlpha *= this.context.globalAlpha;
        },
        //设置透明度
        //ctx.globalAlpha *= this.context.globalAlpha;
        _updateTransform: function () {
            var _transform = new Matrix();
            _transform.identity();    //是否需要Transform
            //是否需要Transform
            if (this.context.scaleX !== 1 || this.context.scaleY !== 1) {
                //如果有缩放
                //缩放的原点坐标
                var origin = new Point(this.context.scaleOrigin);
                if (origin.x || origin.y) {
                    _transform.translate(-origin.x, -origin.y);
                }
                _transform.scale(this.context.scaleX, this.context.scaleY);
                if (origin.x || origin.y) {
                    _transform.translate(origin.x, origin.y);
                }
                ;
            }
            ;
            var rotation = this.context.rotation;
            if (rotation) {
                //如果有旋转
                //旋转的原点坐标
                var origin = new Point(this.context.rotateOrigin);
                if (origin.x || origin.y) {
                    _transform.translate(-origin.x, -origin.y);
                }
                _transform.rotate(rotation % 360 * Math.PI / 180);
                if (origin.x || origin.y) {
                    _transform.translate(origin.x, origin.y);
                }
            }
            ;
            if (this.context.x != 0 || this.context.y != 0) {
                //如果有位移
                _transform.translate(this.context.x, this.context.y);
            }
            this._transform = _transform;
            return _transform;
        },
        getRect: function (style) {
            return {
                x: 0,
                y: 0,
                width: style.width,
                height: style.height
            };
        },
        //显示对象的选取检测处理函数
        getChildInPoint: function (point) {
            var result;    //检测的结果
                           //debugger;
                           //先把鼠标转换到stage下面来
                           /*
            var stage = this.getStage();
            if( stage._transform ){
                console.log( "dom:"+point.x+"||"+point.y )
                var inverseMatrixStage = stage._transform.clone();
                inverseMatrixStage.scale( 1 / stage.context.$model.scaleX , 1 / stage.context.$model.scaleY );
                inverseMatrixStage     = inverseMatrixStage.invert();
                var originPosStage     = [ point.x , point.y ];
                inverseMatrixStage.mulVector( originPosStage , [ point.x , point.y ] );

                point.x = originPosStage[0] ;
                point.y = originPosStage[1] ;
                console.log( "stage:"+point.x+"||"+point.y )
            }
            */
                           //第一步，吧glob的point转换到对应的obj的层级内的坐标系统
            //检测的结果
            //debugger;
            //先把鼠标转换到stage下面来
            /*
            var stage = this.getStage();
            if( stage._transform ){
                console.log( "dom:"+point.x+"||"+point.y )
                var inverseMatrixStage = stage._transform.clone();
                inverseMatrixStage.scale( 1 / stage.context.$model.scaleX , 1 / stage.context.$model.scaleY );
                inverseMatrixStage     = inverseMatrixStage.invert();
                var originPosStage     = [ point.x , point.y ];
                inverseMatrixStage.mulVector( originPosStage , [ point.x , point.y ] );

                point.x = originPosStage[0] ;
                point.y = originPosStage[1] ;
                console.log( "stage:"+point.x+"||"+point.y )
            }
            */
            //第一步，吧glob的point转换到对应的obj的层级内的坐标系统
            if (this.type != 'stage' && this.parent && this.parent.type != 'stage') {
                point = this.parent.globalToLocal(point);
            }
            var x = point.x;
            var y = point.y;    //这个时候如果有对context的set，告诉引擎不需要watch，因为这个是引擎触发的，不是用户
                                //用户set context 才需要触发watch
            //这个时候如果有对context的set，告诉引擎不需要watch，因为这个是引擎触发的，不是用户
            //用户set context 才需要触发watch
            this._notWatch = true;    //对鼠标的坐标也做相同的变换
            //对鼠标的坐标也做相同的变换
            if (this._transform) {
                var inverseMatrix = this._transform.clone().invert();
                var originPos = [
                        x,
                        y
                    ];
                inverseMatrix.mulVector(originPos, [
                    x,
                    y
                ]);
                x = originPos[0];
                y = originPos[1];
            }
            var _rect = this._rect = this.getRect(this.context);
            if (!_rect) {
                return false;
            }
            ;
            if (!this.context.width && !!_rect.width) {
                this.context.width = _rect.width;
            }
            ;
            if (!this.context.height && !!_rect.height) {
                this.context.height = _rect.height;
            }
            ;
            if (!_rect.width || !_rect.height) {
                return false;
            }
            ;    //正式开始第一步的矩形范围判断
            //正式开始第一步的矩形范围判断
            if (x >= _rect.x && x <= _rect.x + _rect.width && y >= _rect.y && y <= _rect.y + _rect.height) {
                //那么就在这个元素的矩形范围内
                result = HitTestPoint.isInside(this, x, y);
            } else {
                //如果连矩形内都不是，那么肯定的，这个不是我们要找的shap
                result = false;
            }
            this._notWatch = false;
            return result;
        },
        _render: function (ctx) {
            if (!this.context.visible || this.context.globalAlpha <= 0) {
                return;
            }
            ctx.save();
            this._transformHander(ctx);    //文本有自己的设置样式方式
            //文本有自己的设置样式方式
            if (this.type != 'text') {
                Base.setContextStyle(ctx, this.context.$model);
            }
            this.render(ctx);
            ctx.restore();
        },
        render: function (ctx) {
        },
        //基类不提供render的具体实现，由后续具体的派生类各自实现
        //从树中删除
        remove: function () {
            if (this.parent) {
                this.parent.removeChild(this);
            }
        },
        //元素的自我销毁
        destroy: function () {
            this.remove();    //把自己从父节点中删除了后做自我清除，释放内存
            //把自己从父节点中删除了后做自我清除，释放内存
            this.context = null;
            delete this.context;
        },
        toString: function () {
            var result;
            if (!this.parent) {
                return this.id + '(stage)';
            }
            for (var o = this; o != null; o = o.parent) {
                var s = o.id + '(' + o.type + ')';
                result = result == null ? s : s + '-->' + result;
                if (o == o.parent || !o.parent)
                    break;
            }
            return result;
        }
    });
    return DisplayObject;
}, {
    requires: [
        'canvax/event/EventDispatcher',
        'canvax/geom/Matrix',
        'canvax/display/Point',
        'canvax/core/Base',
        'canvax/geom/HitTestPoint',
        'canvax/core/propertyFactory'
    ]
});