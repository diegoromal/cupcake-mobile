/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
import { allowed, clearSession, proxyAdmin, sameOrigin, setSession } from '@/lib/server/api-proxy';
const id='11111111-1111-4111-8111-111111111111';
const id2='22222222-2222-4222-8222-222222222222';
const base='http://localhost:3001';
const stagingOrigin='https://app-staging.qosit.cloud';
const req=(path:string,method='GET',body?:BodyInit,headers:Record<string,string>={})=>new NextRequest(`${base}${path}`,{method,body,headers:{origin:process.env.NODE_ENV==='production'&&process.env.APP_PUBLIC_URL?stagingOrigin:base,...headers}});
const originalNodeEnv=process.env.NODE_ENV;
const originalAppPublicUrl=process.env.APP_PUBLIC_URL;
const setNodeEnv=(value:string|undefined)=>value===undefined?Reflect.deleteProperty(process.env,'NODE_ENV'):Reflect.set(process.env,'NODE_ENV',value);
beforeEach(()=>{
 setNodeEnv(originalNodeEnv);
 process.env.API_BASE_URL='http://localhost:3000';
 if(originalNodeEnv==='production') process.env.APP_PUBLIC_URL=stagingOrigin;
 else delete process.env.APP_PUBLIC_URL;
 jest.restoreAllMocks();
});
afterEach(()=>{
 setNodeEnv(originalNodeEnv);
 if(originalAppPublicUrl===undefined) delete process.env.APP_PUBLIC_URL; else process.env.APP_PUBLIC_URL=originalAppPublicUrl;
});
test('allowlist explícita por método e rota',()=>{
 expect(allowed('GET',['produtos'])).toBe(true);expect(allowed('POST',['produtos'])).toBe(true);
 expect(allowed('PATCH',['produtos',id])).toBe(true);expect(allowed('POST',['produtos',id,'imagem'])).toBe(true);
 expect(allowed('DELETE',['produtos',id,'personalizacoes',id2])).toBe(true);
 expect(allowed('GET',['categorias'])).toBe(true);expect(allowed('GET',['personalizacoes'])).toBe(true);
 expect(allowed('POST',['categorias'])).toBe(true);expect(allowed('POST',['personalizacoes'])).toBe(true);
 for(const resource of ['categorias','personalizacoes']) { for(const method of ['GET','PATCH','DELETE']) expect(allowed(method,[resource,id])).toBe(true); for(const method of ['PUT','POST']) expect(allowed(method,[resource,id])).toBe(false); expect(allowed('GET',[resource,id,'extra'])).toBe(false); expect(allowed('GET',[resource,'invalid'])).toBe(false); }
 expect(allowed('DELETE',['categorias'])).toBe(false);expect(allowed('PATCH',['personalizacoes'])).toBe(false);expect(allowed('GET',['produtos','..'])).toBe(false);
 expect(allowed('GET',['users'])).toBe(false);expect(allowed('GET',['produtos',id,'imagem'])).toBe(false);
});
test('origem cruzada rejeitada e cookies protegidos',async()=>{
 const bad=req('/api/admin/produtos','POST','{}',{'content-type':'application/json',origin:'http://evil.test'});
 expect(sameOrigin(bad)).toBe(false);expect((await proxyAdmin(bad,['produtos'])).status).toBe(403);
 const response=NextResponse.json({ok:true});setSession(response,'access','refresh');
 const cookies=response.headers.get('set-cookie')!;
 expect(cookies).toContain('HttpOnly');expect(cookies).toContain('SameSite=lax');expect(cookies).toContain('Path=/');
 expect(await response.text()).not.toContain('access');clearSession(response);
});
test('refresh único, retry único, 403 sem refresh',async()=>{
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValueOnce(new Response('',{status:401})).mockResolvedValueOnce(Response.json({accessToken:'new'})).mockResolvedValueOnce(Response.json([]));
 const request=req('/api/admin/produtos');request.cookies.set('admin_access','old');request.cookies.set('admin_refresh','refresh');
 const result=await proxyAdmin(request,['produtos']);expect(result.status).toBe(200);expect(fetchMock).toHaveBeenCalledTimes(3);
 fetchMock.mockReset().mockResolvedValue(new Response('',{status:403}));
 expect((await proxyAdmin(request,['produtos'])).status).toBe(403);expect(fetchMock).toHaveBeenCalledTimes(1);
});
test('refresh falho limpa sessão; query e rota rejeitadas antes do fetch',async()=>{
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(new Response('',{status:401}));
 const request=req('/api/admin/produtos');request.cookies.set('admin_refresh','refresh');
 const result=await proxyAdmin(request,['produtos']);expect(result.status).toBe(401);expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
 expect((await proxyAdmin(req('/api/admin/produtos?x=1'),['produtos'])).status).toBe(404);
 expect((await proxyAdmin(req('/api/admin/users'),['users'])).status).toBe(404);expect(fetchMock).toHaveBeenCalledTimes(1);
});
test('multipart real mantém campo, filename, bytes e Content-Type',async()=>{
 const bytes=new Uint8Array([0xff,0xd8,0xff,0x00,0x14,0x25]);const file=new File([bytes],'cupcake.jpg',{type:'image/jpeg'});
 const form=new FormData();form.append('imagem',file);
 const fetchMock=jest.spyOn(global,'fetch').mockImplementation(async(_url,init)=>{
   const headers=new Headers(init?.headers);expect(headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
   const upstream=new Request('http://localhost/upload',{method:'POST',body:init?.body,headers});
   const received=await upstream.formData();const copy=received.get('imagem') as File;
   expect(copy.name).toBe('cupcake.jpg');expect(copy.type).toBe('image/jpeg');expect(new Uint8Array(await copy.arrayBuffer())).toEqual(bytes);
   return Response.json({id,imagem:'private-key'});
 });
 for (const length of ['256',undefined]) {
   const request=req(`/api/admin/produtos/${id}/imagem`,'POST',form,length ? {'content-length':length} : {});
   request.cookies.set('admin_access','token');
   expect((await proxyAdmin(request,['produtos',id,'imagem'])).status).toBe(200);
 }
 expect(fetchMock).toHaveBeenCalledTimes(2);
});
test('multipart acima do Content-Length limite rejeita sem ler corpo ou chamar API',async()=>{
 const request=req(`/api/admin/produtos/${id}/imagem`,'POST',new FormData(),{'content-length':String(11*1024*1024+1)});
 request.cookies.set('admin_access','token');
 const read=jest.spyOn(request,'arrayBuffer');const fetchMock=jest.spyOn(global,'fetch');
 expect((await proxyAdmin(request,['produtos',id,'imagem'])).status).toBe(413);
 expect(read).not.toHaveBeenCalled();expect(fetchMock).not.toHaveBeenCalled();
});
test('multipart sem sessão rejeita antes de ler corpo',async()=>{
 const request=req(`/api/admin/produtos/${id}/imagem`,'POST',new FormData());
 const read=jest.spyOn(request,'arrayBuffer');const fetchMock=jest.spyOn(global,'fetch');
 expect((await proxyAdmin(request,['produtos',id,'imagem'])).status).toBe(401);
 expect(read).not.toHaveBeenCalled();expect(fetchMock).not.toHaveBeenCalled();
 const expired=req(`/api/admin/produtos/${id}/imagem`,'POST',new FormData());
 expired.cookies.set('admin_refresh','invalid');
 const expiredRead=jest.spyOn(expired,'arrayBuffer');fetchMock.mockResolvedValueOnce(new Response('',{status:401}));
 expect((await proxyAdmin(expired,['produtos',id,'imagem'])).status).toBe(401);
 expect(expiredRead).not.toHaveBeenCalled();expect(fetchMock).toHaveBeenCalledTimes(1);
});
test('Content-Length inválido não causa crash nem evita verificação do corpo',async()=>{
 const request=req(`/api/admin/produtos/${id}/imagem`,'POST',new FormData(),{'content-length':'11e999'});
 request.cookies.set('admin_access','token');
 const read=jest.spyOn(request,'arrayBuffer').mockResolvedValue({byteLength:11*1024*1024+1} as ArrayBuffer);
 const fetchMock=jest.spyOn(global,'fetch');
 expect((await proxyAdmin(request,['produtos',id,'imagem'])).status).toBe(413);
 expect(read).toHaveBeenCalledTimes(1);expect(fetchMock).not.toHaveBeenCalled();
});
test('login só cria cookies após endpoint ADMIN confirmar acesso',async()=>{
 const {POST}=await import('@/app/api/session/login/route');
 const make=()=>req('/api/session/login','POST',JSON.stringify({email:'admin@example.com',senha:'senha'}),{'content-type':'application/json'});
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValueOnce(Response.json({accessToken:'access',refreshToken:'refresh'})).mockResolvedValueOnce(new Response('',{status:403}));
 const denied=await POST(make());expect(denied.status).toBe(403);expect(denied.headers.get('set-cookie')).toBeNull();expect(fetchMock).toHaveBeenCalledTimes(2);
 fetchMock.mockReset().mockResolvedValueOnce(Response.json({accessToken:'access',refreshToken:'refresh'})).mockResolvedValueOnce(Response.json([]));
 const allowed=await POST(make());expect(allowed.status).toBe(200);expect(allowed.headers.get('set-cookie')).toContain('HttpOnly');expect(await allowed.json()).toEqual({ok:true});
});
test('logout remove cookies sem chamar API',async()=>{
 const {POST}=await import('@/app/api/session/logout/route');const fetchMock=jest.spyOn(global,'fetch');
 const response=await POST(req('/api/session/logout','POST'));expect(response.status).toBe(204);expect(response.headers.get('set-cookie')).toContain('Max-Age=0');expect(fetchMock).not.toHaveBeenCalled();
});
test('login inválido retorna mensagem genérica sem cookies',async()=>{
 const {POST}=await import('@/app/api/session/login/route');jest.spyOn(global,'fetch').mockResolvedValue(new Response('',{status:401}));
 const response=await POST(req('/api/session/login','POST',JSON.stringify({email:'x@example.com',senha:'errada'}),{'content-type':'application/json'}));
 expect(response.status).toBe(401);expect(await response.json()).toEqual({message:'Credenciais inválidas ou acesso indisponível.'});expect(response.headers.get('set-cookie')).toBeNull();
});

test('novos CRUDs rejeitam query, tipo inválido, origem cruzada e UUID inválido',async()=>{
 const fetchMock=jest.spyOn(global,'fetch');
 expect((await proxyAdmin(req('/api/admin/categorias?x=1'),['categorias'])).status).toBe(404);
 expect((await proxyAdmin(req('/api/admin/personalizacoes/invalid'),['personalizacoes','invalid'])).status).toBe(404);
 expect((await proxyAdmin(req('/api/admin/categorias','POST','{}'),['categorias'])).status).toBe(415);
 expect((await proxyAdmin(req('/api/admin/personalizacoes','POST','{}',{'content-type':'application/json',origin:'http://evil.test'}),['personalizacoes'])).status).toBe(403);
 expect(fetchMock).not.toHaveBeenCalled();
});
test('novos CRUDs preservam JSON textual, false e status 400/409/204',async()=>{
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValueOnce(Response.json({message:'Inválido'},{status:400})).mockResolvedValueOnce(Response.json({message:'Em uso'},{status:409})).mockResolvedValueOnce(new Response(null,{status:204}));
 const post=req('/api/admin/personalizacoes','POST',JSON.stringify({nome:'X',disponibilidade:false,ajusteValor:'-0.05'}),{'content-type':'application/json'});post.cookies.set('admin_access','token');
 expect((await proxyAdmin(post,['personalizacoes'])).status).toBe(400);
 const patch=req(`/api/admin/personalizacoes/${id}`,'PATCH',JSON.stringify({ajusteValor:null}),{'content-type':'application/json'});patch.cookies.set('admin_access','token');
 expect((await proxyAdmin(patch,['personalizacoes',id])).status).toBe(409);
 const del=req(`/api/admin/categorias/${id}`,'DELETE');del.cookies.set('admin_access','token');expect((await proxyAdmin(del,['categorias',id])).status).toBe(204);
 expect(fetchMock).toHaveBeenCalledTimes(3);
 expect(new TextDecoder().decode(fetchMock.mock.calls[0][1]?.body as ArrayBuffer)).toContain('"disponibilidade":false');
 expect(new TextDecoder().decode(fetchMock.mock.calls[1][1]?.body as ArrayBuffer)).toContain('"ajusteValor":null');
});

test('origem pública canônica atrás do NPM não confia em forwarded host', async () => {
 setNodeEnv('production');
 process.env.APP_PUBLIC_URL=stagingOrigin;
 const make=(headers:Record<string,string>)=>new NextRequest('http://localhost:3001/api/session/logout',{method:'POST',headers:{host:'app-staging.qosit.cloud','x-forwarded-proto':'https',...headers}});
 const good=make({origin:stagingOrigin});
 expect(good.nextUrl.origin).toBe('http://localhost:3001');
 expect(sameOrigin(good)).toBe(true);
 const permitted=req('/api/admin/produtos','POST','{}',{'content-type':'application/json'});
 permitted.cookies.set('admin_access','token');
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(Response.json({ok:true}));
 expect((await proxyAdmin(permitted,['produtos'])).status).toBe(200);
 expect(fetchMock).toHaveBeenCalledTimes(1);
 for(const headers of ([
   {origin:'https://evil.test'},
   {},
   {origin:stagingOrigin,'sec-fetch-site':'cross-site'},
   {origin:'https://evil.test','x-forwarded-host':'app-staging.qosit.cloud'}
 ] as Record<string,string>[])) expect(sameOrigin(make(headers))).toBe(false);
});

test('production sem APP_PUBLIC_URL rejeita mutação', async () => {
 setNodeEnv('production');
 delete process.env.APP_PUBLIC_URL;
 const request=req('/api/admin/produtos','POST','{}',{'content-type':'application/json'});
 request.cookies.set('admin_access','token');
 const fetchMock=jest.spyOn(global,'fetch');
 expect(await proxyAdmin(request,['produtos'])).toMatchObject({status:403});
 expect(fetchMock).not.toHaveBeenCalled();
});
