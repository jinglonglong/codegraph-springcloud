unit UAuth;

interface

uses
  System.SysUtils,
  System.Classes;

type
  ITokenValidator = interface
    ['{11111111-1111-1111-1111-111111111111}']
    function Validate(const AToken: string): Boolean;
  end;

  TAuthService = class(TInterfacedObject, ITokenValidator)
  public
    function Validate(const AToken: string): Boolean;
    function Login(const AUser, APass: string): string;
  end;

implementation

function TAuthService.Validate(const AToken: string): Boolean;
begin
  Result := AToken <> '';
end;

function TAuthService.Login(const AUser, APass: string): string;
begin
  if Validate(AUser + ':' + APass) then
    Result := 'ok'
  else
    Result := '';
end;

end.
