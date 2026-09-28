/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
import { allowed, clearSession, proxyAdmin, sameOrigin, setSession } from '@/lib/server/api-proxy';
const id='11111111-1111-4111-8111-111111111111';
const id2='22222222-2222-4222-8222-222222222222';
const base='http://localhost:3001';
const req=(path:string,method='GET',body?:BodyInit,headers:Record<string,string>={})=>new NextRequest(`${base}${path}`,{method,body,headers:{origin:base,...headers}});
beforeEach(()=>{process.env.API_BASE_URL='http://localhost:3000';jest.restoreAllMocks();});
test('allowlist explícita por método e rota',()=>{
 expect(allowed('GET',['produtos'])).toBe(true);expect(allowed('POST',['produtos'])).toBe(true);
 expect(allowed('PATCH',['produtos',id])).toBe(true);expect(allowed('POST',['produtos',id,'imagem'])).toBe(true);
 expect(allowed('DELETE',['produtos',id,'personalizacoes',id2])).toBe(true);
 expect(allowed('GET',['categorias'])).toBe(true);expect(allowed('GET',['personalizacoes'])).toBe(true);
 expect(allowed('POST',['categorias'])).toBe(false);expect(allowed('GET',['produtos','..'])).toBe(false);
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
